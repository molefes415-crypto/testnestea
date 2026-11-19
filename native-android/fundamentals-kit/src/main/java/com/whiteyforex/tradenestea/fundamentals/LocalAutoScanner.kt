package com.whiteyforex.tradenestea.fundamentals

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

data class ScanStatus(val running: Boolean = false, val connected: Boolean = false, val terminal: Boolean = false, val executed: Int = 0, val symbol: String = "", val message: String = "Stopped", val bid: Double? = null, val ask: Double? = null)

/** Foreground-only, sequential five-second polling; this is NOT a WebSocket stream. */
class LocalAutoScanner(private val gateway: Mt5Gateway, private val currentSession: () -> Mt5Session?, private val botIsRunning: () -> Boolean) {
    private val mutable = MutableStateFlow(ScanStatus())
    val status = mutable.asStateFlow()
    private var job: Job? = null
    private val history = mutableMapOf<String, MutableList<PriceSample>>()
    private val lastTimes = mutableMapOf<String, Pair<String, Long>>()
    private val attempted = mutableSetOf<String>()
    private val guard = DirectionGuard()
    private var historySession: Mt5Session? = null

    fun start(scope: CoroutineScope, session: Mt5Session, config: List<SymbolConfig>, allowed: Set<String>, botName: String, enabled: Boolean) {
        require(enabled && botIsRunning()) { "Enable Auto Scanner and start your bot first" }
        require(config.isNotEmpty() && config.map { it.symbol }.distinct().size == config.size)
        require(botName.isNotBlank())
        config.forEach { validateConfig(it, allowed) }
        stop()
        if (historySession != session) { history.clear(); lastTimes.clear(); attempted.clear(); historySession = session }
        guard.reset()
        job = scope.launch {
            try {
                gateway.verify(session)
                ensureCurrent(session)
                mutable.value = ScanStatus(running = true, connected = true, terminal = true, message = "Monitoring broker prices")
                while (isActive) {
                    ensureCurrent(session)
                    for (c in config) {
                        ensureCurrent(session)
                        try { scanOne(session, c, botName) }
                        catch (e: GatewayFailure) {
                            if (e.status == 401 || e.status == 403) throw e
                            mutable.value = mutable.value.copy(terminal = false, message = e.message ?: "Gateway read failed")
                        }
                        catch (e: AmbiguousOrder) { throw e }
                        catch (e: CancellationException) { throw e }
                        catch (_: java.io.IOException) { mutable.value = mutable.value.copy(terminal = false, message = "Broker read unavailable; waiting to reverify") }
                    }
                    delay(5_000)
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { mutable.value = mutable.value.copy(running = false, connected = false, terminal = false, message = e.message ?: "Scanner stopped") }
            finally { mutable.value = mutable.value.copy(running = false) }
        }
    }
    private suspend fun ensureCurrent(session: Mt5Session) {
        currentCoroutineContext().ensureActive()
        check(currentSession() == session && botIsRunning()) { "Account changed or bot stopped" }
    }
    private suspend fun scanOne(session: Mt5Session, c: SymbolConfig, botName: String) {
        gateway.verify(session)
        ensureCurrent(session)
        val q = gateway.quote(session, c.symbol)
        ensureCurrent(session)
        val now = System.currentTimeMillis()
        val time = q.time?.takeIf { it.isNotBlank() } ?: error("Broker quote timestamp missing; no trade sent")
        val prior = lastTimes[c.symbol]
        if (prior?.first != time) lastTimes[c.symbol] = time to now
        check(now - (lastTimes[c.symbol]?.second ?: now) <= 30_000) { "Broker quote stopped updating; scanner stopped" }
        val points = history.getOrPut(c.symbol) { mutableListOf() }
        if (points.isEmpty()) {
            try {
                val ticks = gateway.ticks(session, c.symbol)
                ensureCurrent(session)
                if (ticks.symbol == c.symbol) {
                    ticks.ticks.orEmpty().filter { it.size == 3 && it.all(Double::isFinite) && it[1] > 0 && it[2] >= it[1] && it[0] <= ticks.last_msc }
                        .groupBy { (it[0] / 5000).toLong() }.values.map { it.last() }.sortedBy { it[0] }
                        .map { PriceSample(it[1], it[2], now - (ticks.last_msc - it[0].toLong()) - 1) }
                        .filter { now - it.observedAt in 0..600_000 }.forEach(points::add)
                }
            } catch (e: CancellationException) { throw e }
            catch (e: GatewayFailure) { if (e.status == 401 || e.status == 403) throw e }
            catch (_: java.io.IOException) { /* Missing ticks endpoint: warm up from real polling instead. */ }
        }
        points.removeAll { now - it.observedAt !in 0..600_000 || it.observedAt >= now }
        points.add(PriceSample(q.bid, q.ask, now))
        while (points.size > 120) points.removeAt(0)
        val signal = localSignal(c.symbol, points, q.digits, c.style, now)
        guard.observe(c.symbol, signal?.side)
        mutable.value = mutable.value.copy(terminal = true, connected = true, symbol = c.symbol, bid = q.bid, ask = q.ask, executed = 0, message = if (signal == null) "Monitoring broker prices" else "${signal.side.uppercase()} setup")
        if (signal == null) return
        val positions = gateway.positions(session).filter { it.symbol == c.symbol }
        ensureCurrent(session)
        if (positions.isNotEmpty()) {
            if (c.style == TradeStyle.SWING) for (p in positions) {
                if (!guard.canClose(p, signal.side, botName, now)) continue
                gateway.verify(session)
                ensureCurrent(session)
                val closed = gateway.close(session, p.ticket)
                check(confirmed(closed)) { "Broker did not confirm close; scanner stopped, no retry" }
            }
            return // Never open a reverse order in the same cycle as a close.
        }
        if (!guard.canEnter(c.symbol, signal.side) || signal.id in attempted) return
        attempted.add(signal.id) // Retained across Stop/Start; ambiguous attempts cannot be resent.
        repeat(c.trades) { index ->
            gateway.verify(session)
            ensureCurrent(session)
            val fresh = gateway.quote(session, c.symbol)
            ensureCurrent(session)
            val checked = localSignal(c.symbol, points.dropLast(1) + PriceSample(fresh.bid, fresh.ask, System.currentTimeMillis()), fresh.digits, c.style, System.currentTimeMillis())
            check(checked?.side == signal.side && fresh.digits == q.digits) { "Setup changed before execution; scanner stopped" }
            // Preserve the original supplied levels; never recalculate, remove or relax broker stops.
            val sl = signal.sl; val tp = signal.tp
            check(sl == null || tp == null || if (signal.side == "buy") sl < fresh.bid && tp > fresh.ask else sl > fresh.ask && tp < fresh.bid) { "Stop levels no longer valid; no order sent" }
            val reply = gateway.order(session, signal, c.lots, botName)
            check(confirmed(reply)) { "Broker did not confirm order; scanner stopped, no retry" }
            mutable.value = mutable.value.copy(executed = index + 1, message = "Broker confirmed ${index + 1}/${c.trades} ${signal.side.uppercase()} ${c.symbol}")
        }
    }
    fun stop() { job?.cancel(); job = null; mutable.value = mutable.value.copy(running = false, executed = 0, message = "Stopped") }
}