package com.whiteyforex.tradenestea.api

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

/**
 * Fundamentals / news calendar + AI news predictions.
 *  - Calendar (portal):  https://tradenestea.com/admin/api/news.php[?impact=high]
 *  - Calendar (cloud):   https://tradnestea.app/api/public/news?action=calendar
 *  - AI predictions:     https://tradnestea.app/api/public/news?action=predict&symbols=XAUUSD,US30
 * Only signals with confidence >= min_confidence are returned — safe to auto-execute
 * via ScannerEngine / MtApiService while the bot is running.
 */
interface NewsApiService {
    @GET("api/public/news?action=calendar")
    suspend fun calendar(@Query("impact") impact: String? = null): NewsCalendarResponse

    @GET("api/public/news?action=predict")
    suspend fun predict(
        @Query("symbols") symbols: String,
        @Query("min_confidence") minConfidence: Int = 80,
        @Header("x-api-key") apiKey: String = ScannerKey
    ): NewsPredictResponse

    companion object {
        const val ScannerKey = "tnea_33837a5f9367c6cfe2a4f4a9f42b2de30acde3c9"
        fun create(): NewsApiService = Retrofit.Builder()
            .baseUrl("https://tradnestea.app/")
            .client(OkHttpClient.Builder().readTimeout(120, TimeUnit.SECONDS).build())
            .addConverterFactory(GsonConverterFactory.create())
            .build().create(NewsApiService::class.java)
    }
}

/** Direct portal calendar (your news.php). */
interface PortalNewsService {
    @GET("admin/api/news.php")
    suspend fun news(@Query("impact") impact: String? = null): NewsCalendarResponse

    companion object {
        fun create(): PortalNewsService = Retrofit.Builder()
            .baseUrl("https://tradenestea.com/")
            .addConverterFactory(GsonConverterFactory.create())
            .build().create(PortalNewsService::class.java)
    }
}

data class NewsEvent(
    val id: String?, val date: String?, val time: String?, val time_utc: String?,
    val datetime_sast: String?, val day: String?, val name: String?, val currency: String?,
    val impact: String?, val forecast: String?, val previous: String?, val actual: String?
)

data class NewsCalendarResponse(val success: Boolean, val count: Int?, val events: List<NewsEvent>?)

data class NewsPrediction(
    val event_id: String?, val event: String?, val currency: String?, val time_utc: String?,
    val impact: String?, val expected: String?, val predicted_value: String?,
    val currency_bias: String?, val confidence: Int?, val reason: String?
)

data class NewsSignal(
    val symbol: String, val type: String?, val direction: String, val event: String?,
    val event_time_utc: String?, val confidence: Int, val entry_mode: String?,
    val sl_pips: Double?, val tp_pips: Double?, val reason: String?
)

data class NewsPredictResponse(
    val success: Boolean, val predictions: List<NewsPrediction>?,
    val signals: List<NewsSignal>?, val summary: String?, val error: String?
)
