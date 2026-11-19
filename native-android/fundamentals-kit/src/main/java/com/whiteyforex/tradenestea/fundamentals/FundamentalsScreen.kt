package com.whiteyforex.tradenestea.fundamentals

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeFormatter

/** Semantic native palette: pass your selected app accent; default follows the Fundamentals reference. */
object FundamentalsPalette {
    val Accent = Color(0xFF39ED94)
    val Background = Color(0xFF090B10)
    val Surface = Color(0xFF151A21)
    val Text = Color(0xFFF2F5F7)
    val Muted = Color(0xFF9BA6B2)
    val Danger = Color(0xFFEF5263)
    val Medium = Color(0xFFF3BC54)
}
/** Bundled Unicode country flags require no third-party network image service. */
fun countryFlag(code: String): String = code.uppercase().takeIf { it.length == 2 && it.all { c -> c in 'A'..'Z' } }
    ?.map { Character.toChars(0x1F1E6 + it.code - 'A'.code).concatToString() }?.joinToString("") ?: "🌐"
fun currencyCountry(currency: String) = mapOf("USD" to "us", "GBP" to "gb", "JPY" to "jp", "AUD" to "au", "NZD" to "nz", "CAD" to "ca", "CHF" to "ch", "EUR" to "eu", "CNY" to "cn", "ZAR" to "za")[currency] ?: ""

@Composable
fun FundamentalsScreen(
    scanner: LocalAutoScanner,
    session: Mt5Session?,
    allowedSymbols: Set<String>,
    botName: String,
    botRunning: Boolean,
    autoScannerEnabled: Boolean,
    accent: Color = FundamentalsPalette.Accent,
    onConnectMt5: () -> Unit,
    automationApi: NewsAutomationApi = remember { NewsAutomationApi() },
    calendarApi: CalendarApi = remember { CalendarApi() }
) {
    val scope = rememberCoroutineScope()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val status by scanner.status.collectAsState()
    var events by remember { mutableStateOf<List<CalendarEvent>>(emptyList()) }
    var now by remember { mutableStateOf(Instant.now()) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var period by remember { mutableStateOf("Today") }
    var impact by remember { mutableStateOf("All") }
    var query by remember { mutableStateOf("") }
    var selectedEvent by remember { mutableStateOf<CalendarEvent?>(null) }
    var selected by remember { mutableStateOf(allowedSymbols.sorted().firstOrNull().orEmpty()) }
    var lots by remember { mutableStateOf("0.01") }
    var trades by remember { mutableStateOf("1") }
    var style by remember { mutableStateOf(TradeStyle.DAY) }
    suspend fun refresh() {
        loading = true
        try { events = calendarApi.calendar(); error = null }
        catch (_: Exception) { error = "Calendar unavailable; previously loaded releases are retained." }
        finally { loading = false }
    }
    LaunchedEffect(calendarApi) { refresh() }
    LaunchedEffect(Unit) { while (true) { now = Instant.now(); delay(60_000) } }
    LaunchedEffect(session, botRunning, autoScannerEnabled) { scanner.stop() }
    LaunchedEffect(allowedSymbols) { if (selected !in allowedSymbols) { scanner.stop(); selected = allowedSymbols.sorted().firstOrNull().orEmpty() } }
    DisposableEffect(lifecycle, scanner) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_STOP) scanner.stop() }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer); scanner.stop() }
    }
    val colours = darkColorScheme(primary = accent, background = FundamentalsPalette.Background, surface = FundamentalsPalette.Surface,
        onPrimary = FundamentalsPalette.Background, onBackground = FundamentalsPalette.Text, onSurface = FundamentalsPalette.Text, error = FundamentalsPalette.Danger)
    MaterialTheme(colorScheme = colours) {
        selectedEvent?.let { event -> NewsAutomationDialog(event, session, allowedSymbols, automationApi) { selectedEvent = null } }
        Scaffold(containerColor = MaterialTheme.colorScheme.background, topBar = {
            Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(16.dp)) {
                Text("Fundamentals", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                if (status.running || status.executed > 0) {
                    Text("${if (status.connected) "●" else "○"} Connect   ${if (status.terminal) "●" else "○"} Terminal   ${if (status.executed > 0) "●" else "○"} Execute", color = accent)
                    Text(status.message, style = MaterialTheme.typography.bodySmall)
                    if (status.bid != null) Text("${status.symbol} · Bid ${status.bid} · Ask ${status.ask}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }) { insets ->
            LazyColumn(Modifier.padding(insets).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                item {
                    Text("Market sessions", style = MaterialTheme.typography.titleMedium)
                    Column { marketSessions(now).chunked(2).forEach { row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            row.forEach { s -> Column(Modifier.weight(1f).padding(vertical = 12.dp)) {
                                Text("${countryFlag(s.country)}  ${s.name}", style = MaterialTheme.typography.titleMedium)
                                Text(if (s.open) "OPEN · closes in ${s.hours}h" else "Opens in ${s.hours}h", color = if (s.open) accent else FundamentalsPalette.Muted)
                            } }
                        }
                    } }
                }
                item {
                    HorizontalDivider()
                    Text("Auto Scanner", style = MaterialTheme.typography.titleLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        allowedSymbols.sorted().forEach { symbol -> FilterChip(selected = selected == symbol, enabled = !status.running, onClick = { selected = symbol }, label = { Text(symbol) }) }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(lots, { lots = it }, label = { Text("Lots") }, enabled = !status.running, modifier = Modifier.weight(1f), singleLine = true)
                        OutlinedTextField(trades, { trades = it }, label = { Text("Trades") }, enabled = !status.running, modifier = Modifier.weight(1f), singleLine = true)
                    }
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TradeStyle.entries.forEach { choice -> FilterChip(selected = style == choice, enabled = !status.running, onClick = { style = choice }, label = { Text(choice.name.lowercase().replaceFirstChar(Char::titlecase)) }) }
                    }
                    if (session == null) Button(onClick = onConnectMt5) { Text("Connect MT5") }
                    else Button(onClick = {
                        if (status.running) scanner.stop() else try {
                            val config = SymbolConfig(selected, lots.toDoubleOrNull() ?: 0.0, trades.toIntOrNull() ?: 0, style)
                            scanner.start(scope, session, listOf(config), allowedSymbols, botName, autoScannerEnabled)
                            error = null
                        } catch (e: Exception) { error = e.message ?: "Cannot start scanner" }
                    }, enabled = status.running || botRunning && autoScannerEnabled && selected.isNotBlank()) { Text(if (status.running) "Stop" else "Start") }
                    if (!status.running) Text(status.message, style = MaterialTheme.typography.bodySmall)
                    if (style == TradeStyle.SWING) Text("Swing · no SL/TP · guarded reversal closing", style = MaterialTheme.typography.bodySmall, color = FundamentalsPalette.Muted)
                    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
                run {
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("Today", "Tomorrow", "All week").forEach { p -> FilterChip(selected = period == p, onClick = { period = p }, label = { Text(p) }) } }
                        OutlinedTextField(query, { query = it }, label = { Text("Search releases") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("All", "High", "Medium", "Low").forEach { p -> FilterChip(selected = impact == p, onClick = { impact = p }, label = { Text(p) }) } }
                        TextButton(enabled = !loading, onClick = { scope.launch { refresh() } }) { Text(if (loading) "Loading…" else "↻ Refresh · SAST (UTC+2)") }
                    }
                    val day = now.atZone(CalendarParser.SAST).toLocalDate().plusDays(if (period == "Tomorrow") 1 else 0)
                    val visible = events.filter { (period == "All week" || it.instant.atZone(CalendarParser.SAST).toLocalDate() == day) && (impact == "All" || it.impact.equals(impact, true)) && it.name.contains(query, true) }
                    if (visible.isEmpty()) item { Text(if (loading) "Loading releases…" else "No releases match your filters.") }
                    items(visible, key = { it.id }) { event ->
                        Column(Modifier.fillMaxWidth().clickable { selectedEvent = event }.padding(vertical = 8.dp)) {
                            Text("${countryFlag(currencyCountry(event.currency))} ${event.currency} · ${event.impact.uppercase()} · ${DateTimeFormatter.ofPattern("EEE HH:mm").withZone(CalendarParser.SAST).format(event.instant)}", color = accent, style = MaterialTheme.typography.labelMedium)
                            Text(event.name, style = MaterialTheme.typography.titleMedium)
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                listOf("Forecast" to event.forecast, "Previous" to event.previous, "Actual" to event.actual).forEach { (label, value) -> Column(Modifier.weight(1f)) { Text(label, color = FundamentalsPalette.Muted, style = MaterialTheme.typography.labelSmall); Text(value ?: "—") } }
                            }
                            HorizontalDivider(Modifier.padding(top = 12.dp))
                        }
                    }
                }
            }
        }
    }
}