package com.whiteyforex.tradenestea.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * Pop-up subscription (R580/month, PayFast).
 *
 *   if (showPaywall) SubscriptionPopup(email, mentorId,
 *       onActivated = { showPaywall = false; /* unlock */ },
 *       onDismiss = { showPaywall = false })
 *
 * Access is granted ONLY after the server confirms PayFast payment (ITN) AND the
 * mentor portal reports the email active. Opening checkout or returning never unlocks.
 */
@Composable
fun SubscriptionPopup(
    email: String,
    mentorId: String,
    onActivated: () -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    val mail = email.trim().lowercase(Locale.ROOT)
    val mentor = mentorId.trim()
    val validIdentity = mail.isNotBlank() && (mentor.toIntOrNull() ?: 0) > 0
    val prefs = remember(context) { context.getSharedPreferences("tradenest_payment", Context.MODE_PRIVATE) }
    var busy by remember { mutableStateOf(false) }
    var agreed by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf(false) }
    val c = PopupPalette

    val check: () -> Unit = check@{
        if (busy || !validIdentity) return@check
        busy = true; failed = false; message = "Checking your subscription…"
        scope.launch {
            try {
                val id = prefs.getString("pending_payment_id", null)
                val same = prefs.getString("pending_email", null) == mail &&
                    prefs.getString("pending_mentor_id", null) == mentor
                if (id != null && same) {
                    val r = PayFastPopupApi.status(id)
                    val paid = r.optBoolean("paid") && r.optString("status") == "paid" && r.optString("payment_id") == id
                    if (!paid) {
                        message = when (r.optString("status")) {
                            "cancelled" -> "Payment cancelled. Subscription still locked."
                            "failed" -> "Payment not completed. Please try again."
                            else -> "Payment pending. Check again once PayFast confirms."
                        }
                        return@launch
                    }
                }
                if (PayFastPopupApi.access(mentor, mail).opt("active") == true) {
                    if (same) prefs.edit().remove("pending_payment_id").remove("pending_email").remove("pending_mentor_id").apply()
                    onActivated()
                } else message = "This email is not activated under your mentor yet."
            } catch (e: CancellationException) { throw e
            } catch (e: Exception) { failed = true; message = "Couldn’t verify access. Check your connection."
            } finally { busy = false }
        }
    }
    val latest by rememberUpdatedState(check)
    DisposableEffect(lifecycleOwner) {
        val obs = LifecycleEventObserver { _, e -> if (e == Lifecycle.Event.ON_RESUME) latest() }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }

    Dialog(onDismissRequest = { if (!busy) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnClickOutside = false)) {
        Surface(Modifier.padding(20.dp).widthIn(max = 420.dp).fillMaxWidth(),
            shape = RoundedCornerShape(18.dp), color = c.Surface, tonalElevation = 6.dp) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Unlock TradeNest EA", color = c.Fg, fontSize = 22.sp,
                        fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    IconButton(onClick = onDismiss, enabled = !busy) { Icon(Icons.Default.Close, "Close", tint = c.Muted) }
                }
                Text("Secure monthly subscription with PayFast.", color = c.Muted, fontSize = 13.sp)
                Spacer(Modifier.height(14.dp))
                listOf("TradeNest EA membership", "R580 monthly subscription",
                    "Activated under your mentor", "Secure payment with PayFast").forEach { label ->
                    Row(Modifier.padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Check, null, tint = c.Positive, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp)); Text(label, color = c.Fg, fontSize = 13.sp)
                    }
                }
                Spacer(Modifier.height(12.dp))
                Surface(shape = RoundedCornerShape(10.dp), color = c.PrimarySoft,
                    border = BorderStroke(1.dp, c.Primary), modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("1 Month", color = c.Fg, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        Text("R580.00", color = c.Fg, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text(mail.ifBlank { "No email selected" }, color = c.Fg, fontSize = 12.sp)
                Text("Mentor ID: ${mentor.ifBlank { "Not selected" }}", color = c.Muted, fontSize = 11.sp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(agreed, { agreed = it }, enabled = !busy,
                        colors = CheckboxDefaults.colors(checkedColor = c.Primary))
                    Text("I authorise the R580 monthly subscription.", color = c.Fg, fontSize = 12.sp)
                }
                Button(
                    onClick = {
                        busy = true; failed = false; message = "Preparing secure checkout…"
                        scope.launch {
                            try {
                                val p = PayFastPopupApi.create(mail, mentor.toInt())
                                val id = p.optString("payment_id")
                                val url = Uri.parse(p.optString("launch_url"))
                                require(id.matches(Regex("^[A-Za-z0-9_-]{1,120}$")) &&
                                    url.scheme == "https" && url.host == "tradnestea.app")
                                withContext(Dispatchers.IO) {
                                    check(prefs.edit().putString("pending_payment_id", id)
                                        .putString("pending_email", mail).putString("pending_mentor_id", mentor).commit())
                                }
                                context.startActivity(Intent(Intent.ACTION_VIEW, url)) // system browser, not WebView
                                message = "Finish checkout in PayFast, then come back."
                            } catch (e: CancellationException) { throw e
                            } catch (e: Exception) { failed = true; message = "Checkout couldn’t open. Try again."
                            } finally { busy = false }
                        }
                    },
                    enabled = agreed && !busy && validIdentity,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp), shape = RoundedCornerShape(24.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = c.Primary, contentColor = Color.White),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    else Text("Pay R580.00", fontWeight = FontWeight.Bold)
                }
                TextButton(onClick = check, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.Refresh, null, Modifier.size(16.dp)); Spacer(Modifier.width(6.dp))
                    Text("Check payment", color = c.Fg)
                }
                message?.let { Text(it, color = if (failed) c.Error else c.Muted, fontSize = 12.sp) }
            }
        }
    }
}

private object PopupPalette {
    val Surface = Color(0xFFFFFFFF); val Fg = Color(0xFF182735); val Muted = Color(0xFF64748B)
    val Primary = Color(0xFF635BFF); val PrimarySoft = Color(0xFFF5F4FF)
    val Positive = Color(0xFF249A59); val Error = Color(0xFFB42338)
}

/** Portal payment APIs. PHP relays verification to Cloud; no payment secrets in the app. */
object PayFastPopupApi {
    private const val BASE = "https://tradenestea.com/admin/api/"
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS).callTimeout(40, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false).followRedirects(false).followSslRedirects(false).build()

    /** POST payfast_create.php → { success, payment_id, launch_url, ... }
     * launch_url still points to the trusted Cloud checkout; open it unchanged in the browser.
     */
    suspend fun create(email: String, mentor: Int): JSONObject = run(
        Request.Builder().url(BASE + "payfast_create.php").post(
            JSONObject().put("email", email).put("admin_id", mentor).put("user_ref", mentor.toString())
                .toString().toRequestBody("application/json; charset=utf-8".toMediaType())).build())

    /** GET payfast_status.php → { payment_id, status: pending|paid|cancelled|failed, paid } */
    suspend fun status(paymentId: String): JSONObject =
        run(Request.Builder().url(BASE + "payfast_status.php?payment_id=" + Uri.encode(paymentId)).build())

    /** GET check_subscription.php → { success, active: true|false } from the mentor portal */
    suspend fun access(mentor: String, email: String): JSONObject = run(Request.Builder()
        .url(BASE + "check_subscription.php?admin_id=" + Uri.encode(mentor) + "&email=" + Uri.encode(email)).build())

    private suspend fun run(req: Request): JSONObject = withContext(Dispatchers.IO) {
        client.newCall(req.newBuilder().header("Accept", "application/json").build()).execute().use {
            check(it.isSuccessful) { "HTTP ${it.code}" }
            JSONObject(it.body?.string() ?: error("Empty response"))
        }
    }
}
