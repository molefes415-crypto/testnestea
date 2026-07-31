package com.whiteyforex.tradenestea.api

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * MTAPI (mtapi.io) trade execution API — same endpoints the web app uses.
 *
 * MT5 base: https://mt5.mtapi.io/
 * MT4 base: https://mt4.mtapi.io/
 *
 * Flow: Connect -> keep the returned token (id) -> Symbols / OrderSendSafe.
 */
interface MtApiService {

    @GET("Connect")
    suspend fun connect(
        @Query("user") user: String,
        @Query("password") password: String,
        @Query("host") host: String,
        @Query("port") port: Int = 443
    ): String // returns the connection token (id)

    @GET("Symbols")
    suspend fun symbols(@Query("id") id: String): List<String>

    @GET("PriceHistory")
    suspend fun quote(
        @Query("id") id: String,
        @Query("symbol") symbol: String
    ): Map<String, Any>

    /** MT5 safe order send (numeric operation enum). */
    @GET("OrderSendSafe")
    suspend fun orderSendSafe(
        @Query("id") id: String,
        @Query("symbol") symbol: String,
        /** 0 = Buy, 1 = Sell, 2 = BuyLimit, 3 = SellLimit, 4 = BuyStop, 5 = SellStop */
        @Query("operation") operation: Int,
        @Query("volume") volume: Double,
        @Query("price") price: Double? = null,
        @Query("slippage") slippage: Int = 20,
        @Query("stoploss") stoploss: Double? = null,
        @Query("takeprofit") takeprofit: Double? = null,
        @Query("comment") comment: String? = null
    ): Map<String, Any>

    /** MT4 order send (string operation name: Buy / Sell / BuyLimit ...). */
    @GET("OrderSend")
    suspend fun orderSend(
        @Query("id") id: String,
        @Query("symbol") symbol: String,
        @Query("operation") operation: String,
        @Query("volume") volume: Double,
        @Query("price") price: Double? = null,
        @Query("slippage") slippage: Int = 20,
        @Query("stoploss") stoploss: Double? = null,
        @Query("takeprofit") takeprofit: Double? = null,
        @Query("comment") comment: String? = null,
        @Query("placedType") placedType: String = "Manual"
    ): Map<String, Any>

    companion object {
        fun create(platform: String = "MT5"): MtApiService {
            val base = if (platform.uppercase() == "MT4") "https://mt4.mtapi.io/" else "https://mt5.mtapi.io/"
            val client = OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .build()
            return Retrofit.Builder()
                .baseUrl(base)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(MtApiService::class.java)
        }
    }
}
