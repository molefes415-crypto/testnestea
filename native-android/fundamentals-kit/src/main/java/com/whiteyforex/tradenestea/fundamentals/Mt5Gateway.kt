package com.whiteyforex.tradenestea.fundamentals

import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

data class Mt5Identity(val email: String, val mentorId: String)
data class Mt5Session(val token: String, val login: Long, val server: String)
data class Account(val login: Long, val server: String, val name: String?, val balance: Double?, val equity: Double?, val currency: String?, val connected: Boolean?)
data class Quote(val symbol: String, val bid: Double, val ask: Double, val digits: Int, val time: String?)
data class TickHistory(val symbol: String, val last_msc: Long, val ticks: List<List<Double>>?)
data class Position(val ticket: Long, val symbol: String, val type: Int?, val profit: Double?, val comment: String?)
data class OrderResult(val success: Boolean?, val retcode: Int?, val order: Long?, val ticket: Long?, val error: JsonElement?, val comment: String?)
class GatewayFailure(val status: Int, message: String): IOException(message)
class AmbiguousOrder: IOException("Order outcome is unknown. Scanner stopped; check positions before restarting. No retry was sent.")

/** No admin key, passwords in URLs, logging interceptor, provider fallback, redirect or mutation retry. */
class Mt5Gateway {
    companion object { const val BASE = "https://tradenestea.com/admin/api/mt5_gateway.php" }
    private val gson = Gson()
    private fun client(seconds: Long) = OkHttpClient.Builder()
        .connectTimeout(RequestTimeouts.CONNECT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(seconds, TimeUnit.SECONDS).writeTimeout(RequestTimeouts.WRITE_SECONDS, TimeUnit.SECONDS)
        .callTimeout(seconds, TimeUnit.SECONDS).retryOnConnectionFailure(false)
        .followRedirects(false).followSslRedirects(false).build()
    private val linking = client(RequestTimeouts.LINK_SECONDS)
    private val reads = client(RequestTimeouts.READ_SECONDS)
    private val orders = client(RequestTimeouts.ORDER_SECONDS)

    private suspend fun request(action: String, path: String? = null, token: String? = null, method: String = "GET", body: Any? = null, seconds: Int? = null): JsonElement = withContext(Dispatchers.IO) {
        val url = BASE.toHttpUrl().newBuilder().addQueryParameter("a", action)
        path?.let { url.addQueryParameter("p", it) }
        seconds?.let { url.addQueryParameter("seconds", it.toString()) }
        val builder = Request.Builder().url(url.build()).header("Accept", "application/json")
        token?.let { require(it.isNotBlank()); builder.header("X-MT5-Token", it) }
        val payload = body?.let { gson.toJson(it).toRequestBody("application/json".toMediaType()) }
        builder.method(method, if (method == "POST") payload ?: "{}".toRequestBody("application/json".toMediaType()) else payload)
        val http = if (action == "link") linking else if (method == "GET") reads else orders
        var attempt = 0
        while (true) {
            try {
                http.newCall(builder.build()).execute().use { response ->
                    val text = response.body?.string().orEmpty()
                    if (!response.isSuccessful) {
                        // Deliberately omit server bodies: they can echo credentials.
                        throw GatewayFailure(response.code, when(response.code) {
                            401, 403 -> "MT5 session or broker login rejected (HTTP ${response.code}); log in again."
                            530, 502, 503, 504 -> "MT5 gateway unavailable (HTTP ${response.code})."
                            else -> "MT5 request rejected (HTTP ${response.code})."
                        })
                    }
                    val json = try { gson.fromJson(text, JsonElement::class.java) } catch (_: Exception) { throw IOException("Invalid MT5 response") }
                    if (json == null || json.isJsonNull) throw IOException("Empty MT5 response")
                    return@withContext json
                }
            } catch (error: IOException) {
                if (method != "GET" && action != "link") throw AmbiguousOrder()
                if (error is GatewayFailure || method != "GET" || attempt++ >= 1) throw error
                // Exactly one transport-only read retry. Never retry linking or orders.
            }
        }
        @Suppress("UNREACHABLE_CODE") error("Unreachable")
    }
    suspend fun link(login: Long, password: String, server: String, identity: Mt5Identity): Mt5Session {
        require(login > 0 && password.isNotEmpty() && server.isNotBlank())
        require(identity.email.contains("@") && identity.mentorId.isNotBlank())
        val result = request("link", method = "POST", body = mapOf("login" to login, "password" to password, "server" to server, "email" to identity.email, "adminId" to identity.mentorId)).asJsonObject
        val token = listOf("token", "id").firstNotNullOfOrNull { result[it]?.takeIf { value -> value.isJsonPrimitive }?.asString?.takeIf(String::isNotBlank) }
            ?: throw IOException("Gateway did not return a personal token")
        val session = Mt5Session(token, login, server)
        verify(session)
        return session // Persist only AFTER verification, in existing Android Keystore-backed session storage.
    }
    suspend fun account(session: Mt5Session): Account = gson.fromJson(request("proxy", "account", session.token), Account::class.java)
    suspend fun verify(session: Mt5Session): Account {
        val a = account(session)
        require(a.login == session.login && a.server == session.server && a.connected != false) { "MT5 account changed or disconnected; log in again" }
        return a
    }
    suspend fun quote(session: Mt5Session, symbol: String): Quote {
        require(symbol.matches(Regex("[A-Za-z0-9._+#-]{1,24}")))
        val q = gson.fromJson(request("proxy", "quote/$symbol", session.token), Quote::class.java)
        require(q.symbol == symbol && q.bid.isFinite() && q.ask.isFinite() && q.bid > 0 && q.ask >= q.bid && q.digits in 0..10) { "Invalid or mismatched broker quote" }
        return q
    }
    suspend fun ticks(session: Mt5Session, symbol: String): TickHistory = gson.fromJson(request("proxy", "ticks/$symbol", session.token, seconds = 600), TickHistory::class.java)
    suspend fun positions(session: Mt5Session): List<Position> {
        val json = request("proxy", "positions", session.token)
        val array = if (json.isJsonArray) json.asJsonArray else json.asJsonObject["positions"]?.takeIf { it.isJsonArray }?.asJsonArray ?: throw IOException("Could not read open positions")
        return array.map { gson.fromJson(it, Position::class.java) }
    }
    suspend fun history(session: Mt5Session): JsonElement = request("proxy", "history", session.token)
    suspend fun order(session: Mt5Session, signal: LocalSignal, volume: Double, botName: String): OrderResult {
        require(signal.side in setOf("buy", "sell") && volume.isFinite() && volume > 0)
        listOf(signal.sl, signal.tp).forEach { require(it == null || it.isFinite() && it > 0) { "Invalid stop; no order sent" } }
        return gson.fromJson(request("proxy", "order", session.token, "POST", mapOf("symbol" to signal.symbol, "side" to signal.side, "volume" to volume, "sl" to signal.sl, "tp" to signal.tp, "comment" to "$botName-auto", "deviation" to 20)), OrderResult::class.java)
    }
    suspend fun close(session: Mt5Session, ticket: Long): OrderResult = gson.fromJson(request("proxy", "close", session.token, "POST", mapOf("ticket" to ticket)), OrderResult::class.java)
    suspend fun modify(session: Mt5Session, ticket: Long, sl: Double?, tp: Double?): JsonElement {
        listOf(sl, tp).forEach { require(it == null || it.isFinite() && it > 0) }
        return request("proxy", "modify", session.token, "POST", mapOf("ticket" to ticket, "sl" to sl, "tp" to tp))
    }
}