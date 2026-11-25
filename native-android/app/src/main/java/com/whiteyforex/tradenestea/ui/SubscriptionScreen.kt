package com.whiteyforex.tradenestea.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.whiteyforex.tradenestea.MainViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

// Native semantic palette: no WebView, third-party checkout HTML, or merchant secrets.
private object SubscriptionPalette {
    val Background = Color(0xFFEAF0F6)
    val Surface = Color(0xFFFFFFFF)
    val Primary = Color(0xFF635BFF)
    val PrimaryContainer = Color(0xFFF5F4FF)
    val OnPrimary = Color(0xFFFFFFFF)
    val Foreground = Color(0xFF182735)
    val Muted = Color(0xFF64748B)
    val Outline = Color(0xFFDCE3EA)
    val Positive = Color(0xFF249A59)
    val Error = Color(0xFFB42338)
}

/** Replace the uploaded SubscriptionScreen.kt with this file. Keep the existing
 * launcher deep-link filter/return handler. This screen also verifies on resume.
 * Opening checkout or returning from a browser NEVER grants subscription access.
 */
@Composable
fun SubscriptionScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val profile = viewModel.userProfile
    val email = profile?.email.orEmpty().trim().lowercase(java.util.Locale.ROOT)
    val mentor = profile?.mentorId.orEmpty().trim()
    val prefs = remember(context) {
        context.getSharedPreferences("tradenest_payment", android.content.Context.MODE_PRIVATE)
    }
    var busy by remember { mutableStateOf(false) }
    var agreed by rememberSaveable(email, mentor) { mutableStateOf(false) }
    var message by remember(email, mentor) { mutableStateOf<String?>(null) }
    var failed by remember(email, mentor) { mutableStateOf(false) }
    val colors = SubscriptionPalette

    fun identityStillMatches(): Boolean {
        val current = viewModel.userProfile ?: return false
        return current.email.trim().lowercase(java.util.Locale.ROOT) == email &&
            current.mentorId.trim() == mentor
    }

    val checkAccess: () -> Unit = {
        if (!busy) {
            busy = true
            failed = false
            message = "Checking your subscription…"
            scope.launch {
                try {
                    require(email.isNotBlank() && mentor.toIntOrNull()?.let { it > 0 } == true) {
                        "Return to sign in and select your email and mentor."
                    }
                    val id = prefs.getString("pending_payment_id", null)
                    val sameCheckout = prefs.getString("pending_email", null) == email &&
                        prefs.getString("pending_mentor_id", null) == mentor
                    if (id != null && sameCheckout) {
                        val result = SubscriptionRequests.get(
                            "payfast_status.php?payment_id=${Uri.encode(id)}"
                        )
                        val paid = result.optBoolean("paid", false) &&
                            result.optString("status") == "paid" && result.optString("payment_id") == id
                        if (!paid) {
                            message = when (result.optString("status")) {
                                "cancelled" -> "Payment cancelled. Your subscription is still locked."
                                "failed" -> "Payment was not completed. Please try again."
                                else -> "Payment is pending. Check again once PayFast confirms it."
                            }
                            return@launch
                        }
                    }
                    val access = SubscriptionRequests.get(
                        "check_subscription.php?admin_id=${Uri.encode(mentor)}&email=${Uri.encode(email)}"
                    )
                    if (!identityStillMatches()) return@launch
                    if (access.opt("active") == true) {
                        if (sameCheckout) {
                            prefs.edit().remove("pending_payment_id").remove("pending_email")
                                .remove("pending_mentor_id").apply()
                        }
                        // Existing navigation callback, called only AFTER verified mentor access.
                        viewModel.onSubscriptionComplete()
                    } else {
                        message = "This email is not activated under your mentor yet."
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Exception) {
                    failed = true
                    message = "We couldn’t verify access. Check your connection and tap Check payment."
                } finally {
                    busy = false
                }
            }
        }
    }
    val latestCheck by rememberUpdatedState(checkAccess)
    DisposableEffect(context, email, mentor) {
        val lifecycle = (context as? LifecycleOwner)?.lifecycle
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) latestCheck()
        }
        lifecycle?.addObserver(observer)
        onDispose { lifecycle?.removeObserver(observer) }
    }
    LaunchedEffect(email, mentor) { latestCheck() }

    Box(Modifier.fillMaxSize().background(colors.Background).safeDrawingPadding()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Surface(
                modifier = Modifier.widthIn(max = 480.dp).fillMaxWidth()
                    .shadow(12.dp, RoundedCornerShape(16.dp)),
                shape = RoundedCornerShape(16.dp), color = colors.Surface
            ) {
                Column(Modifier.padding(20.dp)) {
                    Box(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 24.dp),
                        contentAlignment = Alignment.Center) {
                        MobiLogo(size = 100.dp, cornerRadius = 20.dp)
                    }
                    Text("Purchase Subscription Access", color = colors.Muted, fontSize = 11.sp)
                    Spacer(Modifier.height(8.dp))
                    Text("Unlock TradeNest EA", color = colors.Foreground, fontSize = 30.sp,
                        lineHeight = 35.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(12.dp))
                    Text("Your trading. Your access.", color = colors.Foreground,
                        fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    Text("Subscribe to TradeNest EA with secure PayFast checkout.",
                        color = colors.Foreground, fontSize = 14.sp, lineHeight = 22.sp)
                    Spacer(Modifier.height(22.dp))
                    SubscriptionDetail("TradeNest EA membership")
                    SubscriptionDetail("R580 monthly subscription")
                    SubscriptionDetail("Activated under your selected mentor")
                    SubscriptionDetail("Secure payment with PayFast")
                    Spacer(Modifier.height(24.dp))
                    Text("Your access period", color = colors.Muted, fontSize = 11.sp)
                    Spacer(Modifier.height(8.dp))
                    // Only the existing monthly plan is offered; reference prices are not our prices.
                    Surface(shape = RoundedCornerShape(10.dp), color = colors.PrimaryContainer,
                        border = BorderStroke(1.dp, colors.Primary), modifier = Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(horizontal = 14.dp, vertical = 16.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("1 Month", color = colors.Foreground, fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(4.dp))
                                Text("Monthly subscription", color = colors.Muted, fontSize = 11.sp)
                            }
                            Spacer(Modifier.width(8.dp))
                            Text("R580.00", color = colors.Foreground, fontSize = 14.sp,
                                fontWeight = FontWeight.Bold)
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    Text(email.ifBlank { "Select your email" }, color = colors.Foreground,
                        fontSize = 12.sp, lineHeight = 18.sp)
                    Text("Mentor ID: ${mentor.ifBlank { "Not selected" }}", color = colors.Muted, fontSize = 11.sp)
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = agreed, onCheckedChange = { agreed = it }, enabled = !busy,
                            colors = CheckboxDefaults.colors(checkedColor = colors.Primary,
                                uncheckedColor = colors.Outline, checkmarkColor = colors.OnPrimary))
                        Text("I authorise the R580 monthly subscription.", color = colors.Foreground,
                            fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = {
                            if (!busy && agreed) {
                                busy = true
                                failed = false
                                message = "Preparing your secure checkout…"
                                scope.launch {
                                    try {
                                        val mentorId = mentor.toIntOrNull()
                                        require(email.isNotBlank() && mentorId != null && mentorId > 0)
                                        val payment = SubscriptionRequests.create(email, mentorId)
                                        val id = payment.optString("payment_id")
                                        val url = Uri.parse(payment.optString("launch_url"))
                                        require(id.matches(Regex("^[A-Za-z0-9_-]{1,120}$")) &&
                                            url.scheme == "https" && url.host == "tradnestea.app")
                                        if (!identityStillMatches()) return@launch
                                        // Commit identity + reference before leaving the app; never save a paid flag.
                                        withContext(Dispatchers.IO) {
                                            check(prefs.edit().putString("pending_payment_id", id)
                                                .putString("pending_email", email).putString("pending_mentor_id", mentor)
                                                .commit())
                                        }
                                        context.startActivity(Intent(Intent.ACTION_VIEW, url))
                                        message = "Finish checkout in PayFast, then return to check payment."
                                    } catch (cancelled: CancellationException) {
                                        throw cancelled
                                    } catch (error: Exception) {
                                        failed = true
                                        message = "Checkout couldn’t open. Check your connection and try again."
                                    } finally { busy = false }
                                }
                            }
                        },
                        enabled = agreed && !busy && email.isNotBlank() && mentor.toIntOrNull()?.let { it > 0 } == true,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp), shape = RoundedCornerShape(24.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = colors.Primary, contentColor = colors.OnPrimary,
                            disabledContainerColor = colors.Outline.copy(alpha = 0.5f), disabledContentColor = colors.Muted)
                    ) {
                        if (busy) CircularProgressIndicator(Modifier.size(20.dp), color = colors.OnPrimary, strokeWidth = 2.dp)
                        else {
                            Text("Pay R580.00", fontWeight = FontWeight.Bold)
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text("Opens secure PayFast checkout", color = colors.Muted, fontSize = 10.sp,
                        modifier = Modifier.align(Alignment.CenterHorizontally))
                    TextButton(onClick = checkAccess, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                        colors = ButtonDefaults.textButtonColors(contentColor = colors.Foreground, disabledContentColor = colors.Muted)) {
                        Icon(Icons.Default.Refresh, null, modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Check payment", fontWeight = FontWeight.SemiBold)
                    }
                    message?.let {
                        Text(it, color = if (failed) colors.Error else colors.Muted, fontSize = 12.sp, lineHeight = 18.sp)
                    }
                }
            }
            Spacer(Modifier.height(20.dp))
            Row(Modifier.widthIn(max = 480.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Lock, null, tint = colors.Muted, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                Text("Access after verified payment", color = colors.Muted, fontSize = 11.sp)
            }
            TextButton(onClick = { viewModel.onBackToWelcome() }, enabled = !busy,
                colors = ButtonDefaults.textButtonColors(contentColor = colors.Muted)) {
                Text("Change email or mentor")
            }
        }
    }
}

@Composable
private fun SubscriptionDetail(label: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Default.Check, null, tint = SubscriptionPalette.Positive,
            modifier = Modifier.size(17.dp))
        Spacer(Modifier.width(10.dp))
        Text(label, color = SubscriptionPalette.Foreground, fontSize = 12.sp,
            lineHeight = 18.sp, modifier = Modifier.weight(1f))
    }
}

private object SubscriptionRequests {
    private const val Base = "https://tradenestea.com/admin/api/"
    private val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS).writeTimeout(30, TimeUnit.SECONDS)
        .callTimeout(40, TimeUnit.SECONDS).retryOnConnectionFailure(false)
        .followRedirects(false).followSslRedirects(false).build()

    suspend fun get(path: String): JSONObject = execute(Request.Builder().url(Base + path).get().build())

    suspend fun create(email: String, mentor: Int): JSONObject {
        val body = JSONObject().put("email", email).put("admin_id", mentor).put("user_ref", mentor.toString())
            .toString().toRequestBody("application/json; charset=utf-8".toMediaType())
        return execute(Request.Builder().url(Base + "payfast_create.php").post(body).build())
    }

    private suspend fun execute(request: Request): JSONObject = withContext(Dispatchers.IO) {
        client.newCall(request.newBuilder().header("Accept", "application/json").build()).execute().use { response ->
            check(response.isSuccessful) { "Subscription service unavailable" }
            JSONObject(response.body?.string() ?: error("Empty subscription response"))
        }
    }
}