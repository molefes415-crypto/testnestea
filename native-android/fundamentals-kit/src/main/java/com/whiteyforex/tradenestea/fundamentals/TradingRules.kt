package com.whiteyforex.tradenestea.fundamentals

import java.time.*
import kotlin.math.*
import org.ta4j.core.BaseBarSeriesBuilder
import org.ta4j.core.indicators.EMAIndicator
import org.ta4j.core.indicators.RSIIndicator
import org.ta4j.core.indicators.helpers.ClosePriceIndicator

object RequestTimeouts {
    const val CONNECT_SECONDS = 20L
    const val LINK_SECONDS = 200L
    const val READ_SECONDS = 30L
    const val ORDER_SECONDS = 30L
    const val WRITE_SECONDS = 30L
}
data class Session(val name: String, val country: String, val open: Boolean, val hours: Int)
fun marketSessions(now: Instant): List<Session> = listOf(
    Triple("Sydney", "au", "Australia/Sydney"), Triple("Tokyo", "jp", "Asia/Tokyo"),
    Triple("London", "gb", "Europe/London"), Triple("New York", "us", "America/New_York")
).map { (name, country, zone) ->
    val local = now.atZone(ZoneId.of(zone))
    val start = if (name == "Tokyo") 9 else 8
    val end = start + 9
    val weekday = local.dayOfWeek.value <= 5
    val open = weekday && local.hour >= start && local.hour < end
    var next = local.toLocalDate().atTime(if (open) end else start, 0).atZone(local.zone)
    if (!open) while (!next.isAfter(local) || next.dayOfWeek.value > 5) next = next.plusDays(1)
    Session(name, country, open, max(1, ceil(Duration.between(local, next).seconds / 3600.0).toInt()))
}

data class PriceSample(val bid: Double, val ask: Double, val observedAt: Long)
enum class TradeStyle { DAY, SCALP, SWING }
data class SymbolConfig(val symbol: String, val lots: Double, val trades: Int, val style: TradeStyle)
data class LocalSignal(val symbol: String, val side: String, val entry: Double, val sl: Double?, val tp: Double?, val id: String)
fun validateConfig(config: SymbolConfig, allowed: Set<String>) {
    require(config.symbol in allowed && config.symbol.matches(Regex("[A-Za-z0-9._+#-]{1,24}"))) { "Choose an exact allowed broker symbol" }
    require(config.lots.isFinite() && config.lots > 0) { "Invalid lot size" }
    require(config.trades in 1..50) { "Trade count must be 1–50; it is never silently changed" }
}
fun confirmed(result: OrderResult): Boolean = result.success != false && result.error == null &&
    (result.retcode?.let { it in setOf(10008, 10009, 10010) } ?: ((result.order ?: result.ticket ?: 0) > 0))

/** The indicator library owns EMA and RSI calculations; these are quote samples, not broker candles. */
fun localSignal(symbol: String, points: List<PriceSample>, digits: Int, style: TradeStyle, now: Long): LocalSignal? {
    if (points.size < 40 || points.last().observedAt - points.first().observedAt < 180_000) return null
    if (digits !in 0..10 || points.any { !it.bid.isFinite() || !it.ask.isFinite() || it.bid <= 0 || it.ask < it.bid || now - it.observedAt !in 0..600_000 }) return null
    if (now - points.last().observedAt > 30_000 || points.zipWithNext().any { (a,b) -> a.observedAt >= b.observedAt }) return null
    val series = BaseBarSeriesBuilder().withName(symbol).build()
    points.forEach { p ->
        val mid = series.numOf((p.bid + p.ask) / 2)
        series.addBar(Duration.ofSeconds(5), Instant.ofEpochMilli(p.observedAt).atZone(ZoneOffset.UTC), mid, mid, mid, mid, series.numOf(0))
    }
    val close = ClosePriceIndicator(series)
    val fast = EMAIndicator(close, 9)
    val slow = EMAIndicator(close, 26)
    val rsi = RSIIndicator(close, 14).getValue(series.endIndex).doubleValue()
    val i = series.endIndex
    val price = close.getValue(i).doubleValue()
    val previous = points.takeLast(6).dropLast(1).map { (it.bid + it.ask) / 2 }
    val buy = fast.getValue(i).isGreaterThan(slow.getValue(i)) && fast.getValue(i).isGreaterThan(fast.getValue(i-1)) && rsi in 55.0..75.0 && price > previous.max()
    val sell = fast.getValue(i).isLessThan(slow.getValue(i)) && fast.getValue(i).isLessThan(fast.getValue(i-1)) && rsi in 25.0..45.0 && price < previous.min()
    if (!buy && !sell) return null
    val last = points.last()
    val entry = if (buy) last.ask else last.bid
    val distance = entry * if (style == TradeStyle.SCALP) 0.0015 else 0.0035
    if (last.ask - last.bid >= distance / 3) return null
    val factor = 10.0.pow(digits)
    fun rounded(value: Double) = round(value * factor) / factor
    val sl = if (style == TradeStyle.SWING) null else rounded(entry + if (buy) -distance else distance)
    val tp = if (style == TradeStyle.SWING) null else rounded(entry + (if (buy) 1 else -1) * distance * if (style == TradeStyle.SCALP) 1.5 else 0.6 / 0.35)
    if (sl != null && tp != null && (if (buy) sl >= last.bid || tp <= last.ask else sl <= last.ask || tp >= last.bid)) return null
    return LocalSignal(symbol, if (buy) "buy" else "sell", entry, sl, tp, "local-$symbol-${now / 900_000}")
}

class DirectionGuard {
    private val streaks = mutableMapOf<String, Pair<String, Int>>()
    private val firstSeen = mutableMapOf<Long, Long>()
    fun observe(symbol: String, side: String?) {
        val prior = streaks[symbol]
        streaks[symbol] = (side ?: "neutral") to if (side == null) 0 else if (prior?.first == side) prior.second + 1 else 1
    }
    fun canEnter(symbol: String, side: String) = streaks[symbol]?.let { it.first == side && it.second >= 2 } ?: false
    fun canClose(p: Position, side: String, botName: String, now: Long): Boolean {
        val seen = firstSeen.getOrPut(p.ticket) { now }
        val owned = p.comment == "$botName-auto" || p.comment == botName
        val opposite = p.type?.let { (it == 0 && side == "sell") || (it == 1 && side == "buy") } ?: false
        val profit = p.profit ?: return false
        return owned && profit.isFinite() && profit <= 0 && opposite && now - seen >= 300_000 &&
            (streaks[p.symbol]?.let { it.first == side && it.second >= 3 } ?: false)
    }
    fun reset() { streaks.clear(); firstSeen.clear() }
}