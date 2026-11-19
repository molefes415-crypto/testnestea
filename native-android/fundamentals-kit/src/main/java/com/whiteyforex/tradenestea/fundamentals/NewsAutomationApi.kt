package com.whiteyforex.tradenestea.fundamentals

import com.google.gson.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import java.util.concurrent.TimeUnit

data class NewsAutomationInput(val eventId: String, val symbols: List<String>, val lot: Double, val trades: Int, val leadSeconds: Int)
data class NewsJob(val id: String, val event_id: String, val execute_at: String, val symbols: List<String>, val lot: Double, val trades: Int, val status: String, val detail: String?)
fun validateNewsAutomation(input: NewsAutomationInput, allowed: Set<String>, release: Instant, now: Instant) {
    require(input.eventId.isNotBlank() && input.eventId.length <= 240)
    require(input.symbols.size in 1..8 && input.symbols.distinct().size == input.symbols.size && input.symbols.all { it in allowed && it.matches(Regex("[A-Za-z0-9._+#-]{1,24}")) }) { "Choose exact allowed broker symbols" }
    require(input.lot.isFinite() && input.lot > 0 && input.lot <= 100) { "Invalid lot size" }
    require(input.trades in 1..100) { "Choose 1–100 trades per symbol" }
    require(input.leadSeconds in 1..900 && release.minusSeconds(input.leadSeconds.toLong()).isAfter(now)) { "Choose a future execution time, 1–900 seconds before release" }
}
class NewsAutomationApi {
    companion object { const val URL = "https://tradnestea.app/api/public/news-automation" }
    private val gson = Gson()
    private val client = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS).callTimeout(120, TimeUnit.SECONDS).retryOnConnectionFailure(false).followRedirects(false).build()
    private suspend fun call(session: Mt5Session, body: Any): JsonElement = withContext(Dispatchers.IO) {
        val request = Request.Builder().url(URL).header("X-MT5-Token", session.token).header("Accept", "application/json")
            .post(gson.toJson(body).toRequestBody("application/json".toMediaType())).build()
        client.newCall(request).execute().use { response ->
            check(response.isSuccessful) { "News automation HTTP ${response.code}; refresh status before trying again" }
            val json = JsonParser.parseString(response.body?.string() ?: error("No scheduling confirmation")).asJsonObject
            check(json["success"]?.asBoolean == true) { "Schedule not confirmed; refresh status" }
            json["data"] ?: error("No schedule result")
        }
    }
    suspend fun list(session: Mt5Session): List<NewsJob> = call(session, mapOf("action" to "list")).asJsonArray.map { gson.fromJson(it, NewsJob::class.java) }
    suspend fun arm(session: Mt5Session, input: NewsAutomationInput): JsonElement = call(session, mapOf("action" to "arm", "input" to input))
    suspend fun cancel(session: Mt5Session, id: String): JsonElement = call(session, mapOf("action" to "cancel", "id" to id))
}