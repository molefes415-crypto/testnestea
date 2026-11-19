package com.whiteyforex.tradenestea.fundamentals

import org.junit.Test
import org.junit.Assert.*
import java.time.Instant

class TradingRulesTest {
    @Test fun linkingAllowsTwoHundredSeconds() { assertEquals(200L, RequestTimeouts.LINK_SECONDS) }
    @Test fun readsUseThirtySeconds() { assertEquals(30L, RequestTimeouts.READ_SECONDS) }
    @Test fun ordersUseThirtySeconds() { assertEquals(30L, RequestTimeouts.ORDER_SECONDS) }
    @Test fun exactSymbolCannotLoseSuffix() {
        assertThrows(IllegalArgumentException::class.java) { validateConfig(SymbolConfig("XAUUSD", 0.01, 1, TradeStyle.DAY), setOf("XAUUSD.m")) }
    }
    @Test fun selectedTradeCountIsNotClamped() {
        validateConfig(SymbolConfig("XAUUSD.m", 0.01, 50, TradeStyle.DAY), setOf("XAUUSD.m"))
        assertThrows(IllegalArgumentException::class.java) { validateConfig(SymbolConfig("XAUUSD.m", 0.01, 51, TradeStyle.DAY), setOf("XAUUSD.m")) }
    }
    @Test fun entryNeedsTwoConsecutiveConfirmations() {
        val g = DirectionGuard(); g.observe("XAUUSD.m", "buy"); assertFalse(g.canEnter("XAUUSD.m", "buy"))
        g.observe("XAUUSD.m", "buy"); assertTrue(g.canEnter("XAUUSD.m", "buy"))
        g.observe("XAUUSD.m", null); assertFalse(g.canEnter("XAUUSD.m", "buy"))
    }
    @Test fun reversalNeedsThreeConfirmationsAndFiveMinutes() {
        val g = DirectionGuard(); val p = Position(1, "XAUUSD.m", 0, -1.0, "mobi ea-auto")
        repeat(2) { g.observe(p.symbol, "sell") }; assertFalse(g.canClose(p,"sell","mobi ea",0))
        g.observe(p.symbol,"sell"); assertFalse(g.canClose(p,"sell","mobi ea",299_999))
        assertTrue(g.canClose(p,"sell","mobi ea",300_000))
    }
    @Test fun profitablePositionNeverCloses() {
        val g = DirectionGuard(); val p = Position(1,"XAUUSD.m",0,8.2,"mobi ea-auto")
        repeat(3) { g.observe(p.symbol,"sell") }; g.canClose(p,"sell","mobi ea",0)
        assertFalse(g.canClose(p,"sell","mobi ea",600_000))
    }
    @Test fun rejectedBrokerReplyIsNotExecution() {
        assertFalse(confirmed(OrderResult(null,10016,1,null,null,"Invalid stops")))
        assertTrue(confirmed(OrderResult(null,10009,1,null,null,"Done")))
    }
    @Test fun strategyRequiresThreeMinutes() {
        val points = (0..39).map { PriceSample(100.0 + it,100.1 + it,1_000_000L + it * 1000) }
        assertNull(localSignal("XAUUSD.m",points,2,TradeStyle.DAY,1_039_000L))
    }
    @Test fun sessionFlagsUseLocalDstAndWeekendRules() {
        assertTrue(marketSessions(Instant.parse("2026-07-01T07:00:00Z")).first { it.name == "London" }.open)
        assertFalse(marketSessions(Instant.parse("2026-11-19T07:00:00Z")).first { it.name == "London" }.open)
        assertTrue(marketSessions(Instant.parse("2026-11-21T12:00:00Z")).none { it.open })
    }
    @Test fun sastCalendarGroupsAreParsedAndDeduplicated() {
        val text = """{"success":true,"groups":{"today":[{"id":1,"title":"CPI","currency":"USD","datetime_sast":"2026-11-19 18:30:00"}],"tomorrow":[{"id":1,"title":"CPI","currency":"USD","datetime_sast":"2026-11-19 18:30:00"}]}}"""
        val events = CalendarParser.parse(text); assertEquals(1,events.size)
        assertEquals(Instant.parse("2026-11-19T16:30:00Z"),events.single().instant)
    }
    @Test fun providerNoticesAreNotNewsEvents() {
        assertEquals(0,CalendarParser.parse("""{"success":true,"events":[{"title":"API key required","ts":1795104000}]}""").size)
    }
    @Test fun newsSchedulingUsesItsExistingHundredTradeLimit() {
        val event = Instant.parse("2026-11-20T12:00:00Z"); val now = event.minusSeconds(1000)
        validateNewsAutomation(NewsAutomationInput("event",listOf("XAUUSD.m"),0.01,100,900),setOf("XAUUSD.m"),event,now)
        assertThrows(IllegalArgumentException::class.java) { validateNewsAutomation(NewsAutomationInput("event",listOf("XAUUSD.m"),0.01,101,900),setOf("XAUUSD.m"),event,now) }
    }
    @Test fun newsLeadCannotExceedFifteenMinutes() {
        val event = Instant.parse("2026-11-20T12:00:00Z")
        assertThrows(IllegalArgumentException::class.java) { validateNewsAutomation(NewsAutomationInput("event",listOf("XAUUSD.m"),0.01,1,901),setOf("XAUUSD.m"),event,event.minusSeconds(1000)) }
    }
}