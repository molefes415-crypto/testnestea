package com.whiteyforex.tradenestea.fundamentals

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeFormatter

@Composable
fun NewsAutomationDialog(event: CalendarEvent, session: Mt5Session?, allowed: Set<String>, api: NewsAutomationApi, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    var chosen by remember(event.id) { mutableStateOf(setOf<String>()) }
    var lot by remember(event.id) { mutableStateOf("0.01") }
    var trades by remember(event.id) { mutableStateOf("1") }
    var lead by remember(event.id) { mutableStateOf("60") }
    var unit by remember(event.id) { mutableStateOf("Seconds") }
    var jobs by remember(event.id) { mutableStateOf<List<NewsJob>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var refreshed by remember { mutableStateOf(false) }
    var uncertain by remember { mutableStateOf(false) }
    suspend fun refresh() {
        if (session == null) return
        try { jobs = api.list(session); refreshed = true }
        catch (_: Exception) { refreshed = false; message = "Schedule status unavailable; wait for verification." }
    }
    LaunchedEffect(event.id, session) { while (true) { refresh(); delay(5_000) } }
    val existing = jobs.find { it.event_id == event.id }
    AlertDialog(onDismissRequest = { if (!busy) onDismiss() }, title = { Text("Automate ${event.name}") }, text = {
        Column(Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("${event.currency} · ${DateTimeFormatter.ofPattern("EEE HH:mm").withZone(CalendarParser.SAST).format(event.instant)} SAST · ${event.impact}")
            Text("FC ${event.forecast ?: "—"} · PREV ${event.previous ?: "—"}")
            Text("Symbols")
            Column { allowed.sorted().chunked(2).forEach { pair -> Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { pair.forEach { symbol ->
                FilterChip(selected = symbol in chosen, enabled = !busy && existing == null, onClick = { chosen = if (symbol in chosen) chosen - symbol else chosen + symbol }, label = { Text(symbol) })
            } } } }
            OutlinedTextField(lot, { lot = it }, label = { Text("Lot size") }, singleLine = true, enabled = !busy && existing == null)
            OutlinedTextField(trades, { trades = it }, label = { Text("Trades per symbol") }, singleLine = true, enabled = !busy && existing == null)
            OutlinedTextField(lead, { lead = it }, label = { Text("Before release · max 15 minutes") }, singleLine = true, enabled = !busy && existing == null)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf("Seconds", "Minutes").forEach { u -> FilterChip(selected = unit == u, enabled = !busy, onClick = { unit = u; lead = if (u == "Minutes") "1" else "60" }, label = { Text(u) }) } }
            Text("AI direction · confidence ≥50% · SL and TP required", style = MaterialTheme.typography.bodySmall)
            existing?.let { job ->
                Text("${job.status.uppercase()} · ${job.detail ?: "Saved for this account"}")
                if (job.status in setOf("queued", "scheduled", "preparing")) TextButton(enabled = !busy, onClick = { scope.launch {
                    busy = true
                    try { if (session != null) { api.cancel(session, job.id); refresh(); message = "Cancellation confirmed" } }
                    catch (_: Exception) { message = "Cancellation not confirmed; refresh its status." }
                    finally { busy = false }
                } }) { Text("Cancel automation") }
            }
            if (session == null) Text("Connect your MT5 account first.")
            if (message.isNotBlank()) Text(message)
        }
    }, confirmButton = {
        Button(enabled = session != null && !busy && refreshed && !uncertain && existing == null && chosen.isNotEmpty(), onClick = { scope.launch {
            busy = true
            try {
                val active = session ?: error("Connect MT5 first")
                val seconds = lead.toIntOrNull()?.let { if (unit == "Minutes") it.toLong() * 60 else it.toLong() } ?: 0L
                require(seconds in 1..900) { "Choose 1–900 seconds before release" }
                val input = NewsAutomationInput(event.id, chosen.toList(), lot.toDoubleOrNull() ?: 0.0, trades.toIntOrNull() ?: 0, seconds.toInt())
                validateNewsAutomation(input, allowed, event.instant, Instant.now())
                uncertain = true // Never blindly resend an unconfirmed scheduling mutation.
                api.arm(active, input)
                refresh()
                message = "Schedule saved for this account. Runs after the app closes."
            } catch (e: Exception) { message = if (uncertain) "Schedule outcome unconfirmed; refresh status before any further action." else e.message ?: "Invalid settings" }
            finally { busy = false }
        } }) { Text(if (busy) "Saving…" else "Automate news") }
    }, dismissButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Close") } })
}