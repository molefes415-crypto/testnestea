package com.whiteyforex.tradenestea.api

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * AI Chart Scanner API (TradeNest EA)
 *
 * Base URL: https://www.tradnestea.app/   (fallback: https://testnestea.lovable.app/)
 * Endpoint: POST /api/public/analyze-chart
 * Auth: header  x-api-key: <SCANNER_API_KEY>   (Bearer token also accepted)
 * The server holds the AI provider key — the native app only sends the scanner key.
 */
interface ScannerApiService {

    @POST("api/public/analyze-chart")
    suspend fun analyzeChart(@Body request: AnalyzeRequest): AnalyzeResponse

    companion object {
        private const val BASE_URL = "https://www.tradnestea.app/"

        /** TradeNest scanner key — same value stored server-side as SCANNER_API_KEY. */
        const val SCANNER_API_KEY = "tnea_33837a5f9367c6cfe2a4f4a9f42b2de30acde3c9"

        fun create(apiKey: String = SCANNER_API_KEY): ScannerApiService {
            val client = OkHttpClient.Builder()
                .addInterceptor { chain ->
                    chain.proceed(
                        chain.request().newBuilder()
                            .addHeader("x-api-key", apiKey)
                            .addHeader("Content-Type", "application/json")
                            .build()
                    )
                }
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(120, TimeUnit.SECONDS) // AI analysis can take a while
                .writeTimeout(120, TimeUnit.SECONDS)
                .build()

            return Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ScannerApiService::class.java)
        }
    }
}


// ---------------- Request ----------------

data class AnalyzeRequest(
    /** Base64 chart screenshot. Raw base64 or a full "data:image/png;base64,..." string. Optional. */
    val imageBase64: String? = null,
    val symbol: String = "XAUUSD",
    /** "all" | "smc" | "ict" | "crt" | "wyckoff" | "priceaction" | "math" */
    val strategy: String = "all",
    val vaultStrategies: List<String> = emptyList(),
    /** "scalp" | "day" | "swing" */
    val tradeStyle: String = "day",
    /** "asia" | "london" | "newyork" | "any" */
    val session: String = "any",
    /** e.g. "M5", "M15", "H1", "H4", "auto" */
    val timeframe: String = "auto",
    val userPrompt: String? = null,
    val dataSource: String? = null,
    val confidenceThreshold: Int? = null,
    /** "instant" | "buy_limit" | "sell_limit" | "buy_stop" | "sell_stop" */
    val orderType: String = "instant",
    val trailStop: Boolean = false,
    val licenseKey: String? = null
)

// ---------------- Response ----------------

data class AnalyzeResponse(
    val direction: String? = null,      // BUY | SELL | NEUTRAL
    val confidence: Int? = null,        // 0-100
    val entry: Double? = null,
    val sl: Double? = null,             // mirrors stopLoss
    val tp: Double? = null,             // mirrors takeProfit[0]
    val stopLoss: Double? = null,
    val takeProfit: List<Double>? = null, // [TP1, TP2, TP3]; empty for swing
    val orderType: String? = null,
    val trailStart: Double? = null,
    val trailStep: Double? = null,
    val closeSignal: String? = null,    // swing-mode exit condition
    val riskReward: Double? = null,
    val timeframe: String? = null,
    val symbol: String? = null,
    val lotSize: Double? = null,
    val reason: String? = null,         // starts with [REVERSAL] or [DIRECT SNIPER]
    val analysis: String? = null,
    val reasoning: String? = null,
    val volatility: String? = null,     // Low | Medium | High
    val structure: String? = null,
    val momentum: String? = null,
    val sources: List<ScannerSource>? = null,
    val keyLevels: KeyLevels? = null,
    val invalidations: List<String>? = null,
    val voiceSummary: String? = null,   // one spoken sentence (TTS ready)
    val annotations: Annotations? = null,
    /** Present only on failure; HTTP status is still 200. */
    val error: String? = null,
    val fallback: Boolean? = null
)

data class ScannerSource(
    val name: String? = null,   // SMC | ICT | CRT | Price Action | Mathematical
    val signal: String? = null, // BUY | SELL | NEUTRAL
    val confidence: Int? = null,
    val note: String? = null
)

data class KeyLevels(
    val support: List<Double>? = null,
    val resistance: List<Double>? = null
)

/** All coordinates are normalized 0..1 relative to the uploaded chart image. */
data class Annotations(
    val trendLine: TrendLine? = null,
    val fvgs: List<Zone>? = null,
    val orderBlocks: List<Zone>? = null,
    val liquidityZones: List<LiquidityZone>? = null,
    val entryLine: Double? = null,
    val slLine: Double? = null,
    val tpLines: List<Double>? = null
)

data class TrendLine(
    val x1: Double? = null,
    val y1: Double? = null,
    val x2: Double? = null,
    val y2: Double? = null,
    val label: String? = null
)

data class Zone(
    val x: Double? = null,
    val y: Double? = null,
    val w: Double? = null,
    val h: Double? = null,
    val type: String? = null, // bullish | bearish
    val label: String? = null
)

data class LiquidityZone(
    val y: Double? = null,
    val label: String? = null,
    val side: String? = null // buy | sell
)
