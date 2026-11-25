package com.whiteyforex.tradenestea.api

import android.content.Context
import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * PayFast subscription API (TradeNest EA) — R580 / month.
 *
 * Base URL: https://tradenestea.com/admin/api/
 *
 * Flow used by the native app:
 *  1. POST payfast_create.php -> payment_id + launch_url + fields
 *  2. Open PayFast in the browser (see [PayFastCheckout.open]) — the user pays there
 *  3. Poll GET payfast_status.php until the exact checkout is paid
 *     (only PayFast's server-to-server ITN can mark a payment paid; the app never decides)
 *  4. On paid -> send the user to the license-key / add-robot screen
 *
 * The return page deep-links back with tradenest://payfast/success, so register
 * that scheme in AndroidManifest to bring the app straight to the foreground.
 */
interface PayFastApiService {

    @POST("payfast_create.php")
    suspend fun createPayment(@Body body: CreatePaymentRequest): CreatePaymentResponse

    @GET("payfast_status.php")
    suspend fun status(
        @Query("payment_id") paymentId: String? = null,
        @Query("email") email: String? = null,
    ): PaymentStatusResponse

    // No PHP cancellation API exists; this optional operation keeps its existing Cloud endpoint.
    @POST("https://tradnestea.app/api/public/payfast?action=cancel")
    suspend fun cancel(@Body body: CancelPaymentRequest): PaymentStatusResponse

    companion object {
        private const val BASE_URL = "https://tradenestea.com/admin/api/"

        fun create(): PayFastApiService {
            val client = OkHttpClient.Builder()
                .addInterceptor { chain ->
                    chain.proceed(
                        chain.request().newBuilder()
                            .addHeader("Content-Type", "application/json")
                            .addHeader("Accept", "application/json")
                            .build()
                    )
                }
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .callTimeout(40, TimeUnit.SECONDS)
                .retryOnConnectionFailure(false)
                .followRedirects(false)
                .followSslRedirects(false)
                .build()

            return Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(PayFastApiService::class.java)
        }
    }
}

// ---------------------------------------------------------------------------
// Data shapes
// ---------------------------------------------------------------------------

data class CreatePaymentRequest(
    /** Customer email — also used to match the payment to their license. */
    val email: String,
    /** Numeric mentor ID; never substitute the email. */
    val user_ref: String? = null,
    val admin_id: Int? = null,
)

data class CreatePaymentResponse(
    val payment_id: String? = null,
    /** https://www.payfast.co.za/eng/process */
    val process_url: String? = null,
    /** Server-signed PayFast form fields (kept for reference). */
    val fields: Map<String, String>? = null,
    /**
     * The single link the app opens — a hosted self-submitting form on the
     * trusted Cloud URL returned by PHP (https://tradnestea.app/api/public/payfast
     * ?action=launch). This is the payment gate link for the native app.
     */
    val launch_url: String? = null,
    val amount: String? = null,
    val currency: String? = null,
    val status: String? = null,
    val error: String? = null,
)

data class PaymentStatusResponse(
    /** pending | paid | cancelled | failed */
    val status: String? = null,
    val paid: Boolean = false,
    val payment_id: String? = null,
    val error: String? = null,
)

data class CancelPaymentRequest(val payment_id: String)

// ---------------------------------------------------------------------------
// Checkout helper
// ---------------------------------------------------------------------------

object PayFastCheckout {

    private val api = PayFastApiService.create()

    /** Step 1: ask our server for a signed payment. */
    suspend fun start(email: String, userRef: String? = null): CreatePaymentResponse {
        val mentorId = userRef?.toIntOrNull()
        require(mentorId != null && mentorId > 0) { "The current mentor ID is required for payment" }
        return api.createPayment(CreatePaymentRequest(email = email, user_ref = mentorId.toString(), admin_id = mentorId))
    }

    /**
     * Step 2: open PayFast. We open the server-hosted launcher returned by PHP
     * (https://tradnestea.app/api/public/payfast
     * ?action=launch), which serves a self-submitting POST form with the
     * server-signed fields. This avoids the data: URL that Android Chrome
     * blocks from top-level navigation (the cause of the black screen).
     */
    fun open(context: Context, payment: CreatePaymentResponse) {
        val launchUrl = payment.launch_url ?: return
        PayFastReturnHandler(context).rememberCheckout(payment)
        context.startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(launchUrl))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    /**
     * Step 3: poll our backend until PayFast's ITN confirms the payment.
     * Returns true only when the server says paid.
     */
    suspend fun awaitPaid(
        paymentId: String? = null,
        email: String? = null,
        timeoutMs: Long = 10 * 60 * 1000L,
        intervalMs: Long = 4000L,
    ): Boolean = withTimeoutOrNull(timeoutMs) {
        while (true) {
            val s = runCatching { api.status(paymentId, email) }.getOrNull()
            when {
                s?.paid == true -> return@withTimeoutOrNull true
                s?.status == "cancelled" || s?.status == "failed" -> return@withTimeoutOrNull false
            }
            delay(intervalMs)
        }
        @Suppress("UNREACHABLE_CODE") false
    } ?: false

    /** One-shot check — use on app resume / "CHECK PAYMENT STATUS". */
    suspend fun isPaid(paymentId: String? = null, email: String? = null): Boolean =
        runCatching { api.status(paymentId, email).paid }.getOrDefault(false)

    /** User backed out of checkout. Never downgrades a verified payment. */
    suspend fun cancel(paymentId: String) {
        runCatching { api.cancel(CancelPaymentRequest(paymentId)) }
    }
}
