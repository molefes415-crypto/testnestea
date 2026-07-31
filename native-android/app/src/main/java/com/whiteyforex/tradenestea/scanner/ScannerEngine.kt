package com.whiteyforex.tradenestea.scanner

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import com.whiteyforex.tradenestea.api.AnalyzeRequest
import com.whiteyforex.tradenestea.api.AnalyzeResponse
import com.whiteyforex.tradenestea.api.MtApiService
import com.whiteyforex.tradenestea.api.ScannerApiService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

/**
 * AI Chart Scanner engine for the native app.
 *
 * 1. Upload a chart screenshot (gallery Uri, camera Bitmap, or raw bytes) -> base64 -> AI scan.
 * 2. Auto-scan loop: re-scan a symbol on an interval (no image needed) and auto-execute.
 * 3. Execution goes straight to MTAPI with the AI's entry / SL / TP.
 */
class ScannerEngine(
    private val scanner: ScannerApiService = ScannerApiService.create(),
    private val platform: String = "MT5"
) {
    private val mt: MtApiService = MtApiService.create(platform)
    private var autoJob: Job? = null

    // ---------------- image -> base64 ----------------

    /** Gallery / file picker Uri (compressed to keep the payload small). */
    suspend fun encodeChart(resolver: ContentResolver, uri: Uri): String =
        withContext(Dispatchers.IO) {
            val bmp = resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it) }
                ?: error("Could not read the selected image")
            encodeChart(bmp)
        }

    /** Camera / screenshot bitmap. Downscaled to max 1600px so uploads stay fast. */
    fun encodeChart(bitmap: Bitmap, maxSide: Int = 1600, quality: Int = 85): String {
        val scale = maxSide.toFloat() / maxOf(bitmap.width, bitmap.height)
        val scaled = if (scale < 1f)
            Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true)
        else bitmap
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }

    // ---------------- scan ----------------

    /**
     * Analyse a chart. Pass [imageBase64] from encodeChart() to send the uploaded
     * screenshot, or leave it null for a symbol-only (no-image) scan.
     */
    suspend fun scan(
        symbol: String,
        imageBase64: String? = null,
        tradeStyle: String = "day",
        strategy: String = "all",
        session: String = "any",
        timeframe: String = "auto",
        orderType: String = "instant",
        trailStop: Boolean = false,
        userPrompt: String? = null,
        licenseKey: String? = null
    ): AnalyzeResponse = scanner.analyzeChart(
        AnalyzeRequest(
            imageBase64 = imageBase64,
            symbol = symbol,
            strategy = strategy,
            tradeStyle = tradeStyle,
            session = session,
            timeframe = timeframe,
            orderType = orderType,
            trailStop = trailStop,
            userPrompt = userPrompt,
            licenseKey = licenseKey
        )
    )

    /** Scan an uploaded screenshot and immediately execute if it passes the filter. */
    suspend fun scanAndExecute(
        token: String,
        symbol: String,
        imageBase64: String?,
        lotSize: Double,
        numTrades: Int = 1,
        minConfidence: Int = 72,
        tradeStyle: String = "day",
        comment: String = "TradeNest",
        onLog: (String) -> Unit = {}
    ): AnalyzeResponse {
        val res = scan(symbol = symbol, imageBase64 = imageBase64, tradeStyle = tradeStyle)
        if (res.error != null) { onLog("Scan failed: ${res.error}"); return res }
        val dir = res.direction?.uppercase()
        if (dir != "BUY" && dir != "SELL") { onLog("No setup — $symbol NEUTRAL"); return res }
        if ((res.confidence ?: 0) < minConfidence) {
            onLog("Skipped $symbol — confidence ${res.confidence} < $minConfidence"); return res
        }
        execute(token, res, lotSize, numTrades, comment, onLog)
        return res
    }

    // ---------------- auto scan ----------------

    /**
     * Start the auto analyse + execute loop. Rescans every [intervalMs] for each symbol
     * and fires trades that clear [minConfidence]. Call [stopAuto] to cancel.
     */
    fun startAuto(
        scope: CoroutineScope,
        token: String,
        symbols: List<String>,
        lotSize: Double,
        numTrades: Int = 1,
        minConfidence: Int = 72,
        tradeStyle: String = "day",
        intervalMs: Long = 300_000L,
        comment: String = "TradeNest",
        onResult: (AnalyzeResponse) -> Unit = {},
        onLog: (String) -> Unit = {}
    ) {
        stopAuto()
        autoJob = scope.launch(Dispatchers.IO) {
            while (isActive) {
                for (sym in symbols) {
                    if (!isActive) break
                    try {
                        val res = scanAndExecute(
                            token = token,
                            symbol = sym,
                            imageBase64 = null, // auto mode is symbol-only; the AI reads live structure
                            lotSize = lotSize,
                            numTrades = numTrades,
                            minConfidence = minConfidence,
                            tradeStyle = tradeStyle,
                            comment = comment,
                            onLog = onLog
                        )
                        onResult(res)
                    } catch (e: Exception) {
                        onLog("Auto scan error on $sym: ${e.message}")
                    }
                    delay(2_000L)
                }
                delay(intervalMs)
            }
        }
    }

    fun stopAuto() {
        autoJob?.cancel()
        autoJob = null
    }

    // ---------------- execution ----------------

    /** Places [numTrades] orders from an AI result, carrying SL and TP through. */
    suspend fun execute(
        token: String,
        res: AnalyzeResponse,
        lotSize: Double,
        numTrades: Int = 1,
        comment: String = "TradeNest",
        onLog: (String) -> Unit = {}
    ) {
        val dir = res.direction?.uppercase() ?: return
        val symbol = resolveSymbol(token, res.symbol ?: return)
        val sl = res.sl ?: res.stopLoss
        val tp = res.tp ?: res.takeProfit?.firstOrNull()
        val count = numTrades.coerceIn(1, 50)

        repeat(count) { i ->
            try {
                if (platform.uppercase() == "MT4") {
                    mt.orderSend(
                        id = token, symbol = symbol,
                        operation = if (dir == "BUY") "Buy" else "Sell",
                        volume = lotSize, stoploss = sl, takeprofit = tp, comment = comment
                    )
                } else {
                    mt.orderSendSafe(
                        id = token, symbol = symbol,
                        operation = if (dir == "BUY") 0 else 1,
                        volume = lotSize, stoploss = sl, takeprofit = tp, comment = comment
                    )
                }
                onLog("Executed ${i + 1}/$count $dir $symbol @ ${res.entry} SL $sl TP $tp")
            } catch (e: Exception) {
                onLog("Trade ${i + 1} failed: ${e.message}")
            }
            if (i < count - 1) delay(400L)
        }
    }

    /** Maps a generic symbol (XAUUSD, US30) to the broker's actual name (XAUUSD.m, .US30.). */
    private suspend fun resolveSymbol(token: String, wanted: String): String {
        return try {
            val list = mt.symbols(token)
            val target = wanted.uppercase().filter { it.isLetterOrDigit() }
            list.firstOrNull { it.equals(wanted, true) }
                ?: list.firstOrNull { it.uppercase().filter { c -> c.isLetterOrDigit() } == target }
                ?: list.firstOrNull { it.uppercase().contains(target) }
                ?: wanted
        } catch (_: Exception) {
            wanted
        }
    }
}
