package com.whiteyforex.tradenestea.fundamentals

import com.google.gson.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.time.*
import java.util.concurrent.TimeUnit

data class CalendarEvent(val id: String, val name: String, val currency: String, val impact: String, val instant: Instant, val forecast: String?, val previous: String?, val actual: String?)
object CalendarParser {
    val SAST: ZoneId = ZoneId.of("Africa/Johannesburg")
    fun parse(text: String): List<CalendarEvent> {
        val root = JsonParser.parseString(text).asJsonObject
        require(root["success"]?.asBoolean == true) { "Calendar unavailable" }
        val raw = root["events"]?.takeIf { it.isJsonArray }?.asJsonArray?.toList()
            ?: root["groups"]?.takeIf { it.isJsonObject }?.asJsonObject?.entrySet()?.flatMap { (_, v) -> if (v.isJsonArray) v.asJsonArray.toList() else emptyList() }.orEmpty()
        return raw.mapNotNull { item -> runCatching {
            val e = item.asJsonObject
            fun value(key: String): String? = e[key]?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }
            val name = value("title") ?: value("name") ?: return@runCatching null
            if (name.contains("api key", true) || name.contains("financecalendar.com/account", true)) return@runCatching null
            val stamp = value("ts") ?: value("timestamp") ?: value("time_utc") ?: value("datetime_sast") ?: return@runCatching null
            val numeric = stamp.toDoubleOrNull()
            val instant = if (numeric != null && numeric.isFinite()) Instant.ofEpochMilli((numeric * if (numeric < 1e12) 1000 else 1).toLong()) else {
                val iso = stamp.replace(' ', 'T')
                runCatching { Instant.parse(iso) }.getOrElse {
                    runCatching { OffsetDateTime.parse(iso).toInstant() }.getOrElse {
                        // Only unzoned datetime_sast is documented; never guess the time zone of time_utc.
                        require(value("time_utc") == null && value("datetime_sast") != null)
                        LocalDateTime.parse(iso).atZone(SAST).toInstant()
                    }
                }
            }
            val currency = value("currency")?.uppercase().orEmpty()
            CalendarEvent(value("id") ?: "$currency-$name-$instant", name, currency, value("impact")?.lowercase() ?: "unknown", instant, value("forecast"), value("previous"), value("actual"))
        }.getOrNull() }.distinctBy { it.id }.sortedBy { it.instant }
    }
}
class CalendarApi {
    companion object { const val URL = "https://tradenestea.com/admin/api/news.php" }
    private val client = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.SECONDS).retryOnConnectionFailure(false).build()
    suspend fun calendar(): List<CalendarEvent> = withContext(Dispatchers.IO) {
        client.newCall(Request.Builder().url(URL).header("Accept", "application/json").build()).execute().use { response ->
            check(response.isSuccessful) { "Calendar HTTP ${response.code}" }
            CalendarParser.parse(response.body?.string() ?: error("Empty calendar response"))
        }
    }
}