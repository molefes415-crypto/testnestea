package com.whiteyforex.tradenestea.api

import android.content.Context
import android.net.Uri

/** Store only the checkout reference, never a local paid flag or merchant keys. */
class PayFastReturnHandler(context: Context) {
    private val prefs = context.getSharedPreferences("tradenest_payment", Context.MODE_PRIVATE)
    private val api = PayFastApiService.create()

    fun rememberCheckout(payment: CreatePaymentResponse) {
        val id = payment.payment_id ?: return
        if (Regex("^[A-Za-z0-9_-]{1,120}$").matches(id)) {
            prefs.edit().putString("pending_payment_id", id).apply()
        }
    }

    /** Call in onCreate/onNewIntent and again onResume; URL success never unlocks. */
    suspend fun verifyReturn(uri: Uri? = null): Boolean {
        val expected = prefs.getString("pending_payment_id", null) ?: return false
        if (uri != null) {
            if (uri.scheme != "tradenest" || uri.host != "payfast") return false
            if (uri.getQueryParameter("payment_id") != expected) return false
        }
        val response = runCatching { api.status(paymentId = expected) }.getOrNull() ?: return false
        return response.payment_id == expected && response.status == "paid" && response.paid
    }

    // Keep the reference until existing account/access refresh succeeds.
    fun clearAfterAccountRefresh() {
        prefs.edit().remove("pending_payment_id").apply()
    }
}