package com.whiteyforex.tradenestea.api

import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.GET
import retrofit2.http.Query
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.Retrofit

interface ApiService {
    @POST("admin/api/validate_license.php")
    suspend fun validateLicense(@Body request: LicenseRequest): LicenseResponse

    @POST("admin/api/check_subscription.php")
    suspend fun checkSubscription(@Body request: SubscriptionRequest): SubscriptionResponse

    @GET("admin/api/signals.php?action=get")
    suspend fun getSignals(
        @Query("key") key: String,
        @Query("limit") limit: Int = 8
    ): SignalResponse

    @POST("admin/api/signals.php?action=read")
    suspend fun markSignalsRead(@Body request: ReadSignalRequest): Map<String, Any>

    @GET("admin/api/check_status.php")
    suspend fun checkUserStatus(
        @Query("email") email: String
    ): StatusResponse

    companion object {
        private const val BASE_URL = "https://tradenestea.com/"

        fun create(): ApiService {
            return Retrofit.Builder()
                .baseUrl(BASE_URL)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ApiService::class.java)
        }
    }
}

data class LicenseRequest(
    val key: String,
    val device_id: String? = null
)

data class SubscriptionRequest(
    val email: String,
    val mentor_id: String
)

data class SubscriptionResponse(
    val success: Boolean,
    val activated: Boolean,
    val message: String
)

data class LicenseResponse(
    val success: Boolean,
    val status: String?,
    val message: String?,
    val expires_at: String?,
    val symbols: List<String>?,
    val bot: BotInfo?,
    val ea_name: String?,
    val ea_logo: String?,
    val robot_name: String?,
    val robot_logo: String?,
    val robot_image: String?,
    val mentor: MentorInfo?,
    val signals: Map<String, List<TradeSignal>>?
)

data class BotInfo(
    val name: String?,
    val image: String?,
    val logo: String?,
    val ea_logo: String?,
    val robot_logo: String?,
    val robot_image: String?,
    val symbols: List<String>?
)

data class MentorInfo(
    val display_name: String?,
    val full_name: String?,
    val profile_pic: String?,
    val logo: String?,
    val avatar: String?,
    val image: String?
)

data class AppInfo(
    val name: String?,
    val owner_logo: String?
)

data class SignalRequest(
    val key: String
)

data class SignalResponse(
    val success: Boolean,
    val count: Int? = null,
    val signals: Any? = null // Can be List<TradeSignal> or Map<String, List<TradeSignal>>
)

data class ReadSignalRequest(
    val key: String,
    val ids: List<String>
)

data class TradeSignal(
    val symbol: String?,
    val direction: String?,
    val entry: Double?,
    val stop_loss: Double?,
    val take_profit: Double?,
    val lot_size: Double?,
    val time: String?
)

data class StatusResponse(
    val success: Boolean,
    val isActivated: Boolean,
    val message: String? = null
)
