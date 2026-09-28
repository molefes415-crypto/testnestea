package com.whiteyforex.tradenestea.scanner

import com.whiteyforex.tradenestea.api.MtApiService
import com.whiteyforex.tradenestea.api.NewsApiService
import com.whiteyforex.tradenestea.api.NewsSignal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Auto-trades AI news predictions. Polls /api/public/news?action=predict, and for every
 * signal >= minConfidence on an allowed symbol, places [numTrades] orders with SL/TP
 * (pips converted to prices from the live quote). Each signal executes once.
 *
 * Usage (only while the bot is started):
 *   newsTrader.start(viewModelScope, token, allowedSymbols, lot = 0.01, numTrades = 1,
 *                    minConfidence = 50, comment = botName, onLog = ::log)
 *   newsTrader.stop() when the bot stops.
 */
class NewsTrader(
    private val platform: String = "MT5",
    private val news: NewsApiService = NewsApiService.create()
) {
    private val mt = MtApiService.create(platform)
    private var job: Job? = null
    private val executed = mutableSetOf<String>()

    fun start(
        scope: CoroutineScope,
        token: String,
        symbols: List<String>,
        lot: Double,
        numTrades: Int = 1,
        minConfidence: Int = 50,
        comment: String = "TradeNest",
        intervalMs: Long = 5 * 60_000L,
        onLog: (String) -> Unit = {}
    ) {
        stop()
        if (symbols.isEmpty()) return
        job = scope.launch(Dispatchers.IO) {
            while (isActive) {
                try {
                    val res = news.predict(symbols.joinToString(","), minConfidence)
                    if (!res.success) onLog("News AI: ${res.error}")
                    res.signals.orEmpty().forEach { sig ->
                        val key = "${sig.symbol}|${sig.event}|${sig.event_time_utc}|${sig.direction}"
                        if (key in executed) return@forEach
                        val allowed = symbols.firstOrNull { base(it) == base(sig.symbol) } ?: return@forEach
                        if (sig.confidence < minConfidence) return@forEach
                        executed += key
                        execute(token, allowed, sig, lot, numTrades, comment, onLog)
                    }
                } catch (e: Exception) {
                    onLog("News poll error: ${e.message}")
                }
                delay(intervalMs)
            }
        }
    }

    fun stop() { job?.cancel(); job = null }

    private suspend fun execute(
        token: String, symbol: String, sig: NewsSignal, lot: Double,
        numTrades: Int, comment: String, onLog: (String) -> Unit
    ) {
        val buy = sig.direction.equals("BUY", true)
        val broker = resolveSymbol(token, symbol)
        val price = livePrice(token, broker, buy)
        val pip = pipSize(broker)
        val slPips = (sig.sl_pips ?: 30.0).coerceAtLeast(1.0)
        val tpPips = (sig.tp_pips ?: slPips * 2).coerceAtLeast(slPips * 1.5)
        val sl = price?.let { if (buy) it - slPips * pip else it + slPips * pip }
        val tp = price?.let { if (buy) it + tpPips * pip else it - tpPips * pip }
        onLog("NEWS ${sig.direction} $broker ${sig.confidence}% — ${sig.event} | SL $sl TP $tp")

        repeat(numTrades.coerceIn(1, 50)) { i ->
            val ok = send(token, broker, buy, lot, sl, tp, comment) ||
                send(token, broker, buy, lot, null, null, comment) // retry without stops on rejection
            onLog(if (ok) "News trade ${i + 1}/$numTrades placed" else "News trade ${i + 1} failed")
            delay(400L)
        }
    }

    private suspend fun send(
        token: String, symbol: String, buy: Boolean, lot: Double,
        sl: Double?, tp: Double?, comment: String
    ): Boolean = try {
        if (platform.uppercase() == "MT4")
            mt.orderSend(token, symbol, if (buy) "Buy" else "Sell", lot, stoploss = sl, takeprofit = tp, comment = comment)
        else
            mt.orderSendSafe(token, symbol, if (buy) 0 else 1, lot, stoploss = sl, takeprofit = tp, comment = comment)
        true
    } catch (_: Exception) { false }

    private suspend fun livePrice(token: String, symbol: String, buy: Boolean): Double? = try {
        val q = mt.getQuote(token, symbol)
        ((if (buy) q["ask"] ?: q["Ask"] else q["bid"] ?: q["Bid"]) as? Number)?.toDouble()
    } catch (_: Exception) { null }

    private suspend fun resolveSymbol(token: String, wanted: String): String = try {
        val list = mt.symbols(token)
        list.firstOrNull { it.equals(wanted, true) }
            ?: list.firstOrNull { base(it) == base(wanted) }
            ?: list.firstOrNull { base(it).startsWith(base(wanted)) }
            ?: wanted
    } catch (_: Exception) { wanted }

    private fun base(s: String) = s.uppercase().filter { it.isLetterOrDigit() }.removeSuffix("M")

    private fun pipSize(symbol: String): Double {
        val s = symbol.uppercase()
        return when {
            "XAU" in s || "GOLD" in s -> 0.1
            "XAG" in s -> 0.01
            "JPY" in s -> 0.01
            listOf("US30", "NAS", "SPX", "US500", "GER", "DAX", "UK100", "BTC", "ETH").any { it in s } -> 1.0
            else -> 0.0001
        }
    }
}
