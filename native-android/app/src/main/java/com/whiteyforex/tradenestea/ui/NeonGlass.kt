package com.whiteyforex.tradenestea.ui

import android.graphics.BlurMaskFilter
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Presentation-only neon glass look matching the web app. One accent recolours everything. */
object Neon {
    val Accent = Color(0xFF9B5CFF)
    val Background = Color(0xFF0B0714)
    val Surface = Color(0xFF151022)
    val Success = Color(0xFF22C55E)
    val Danger = Color(0xFFEF4444)
}

fun Modifier.neonCard(
    accent: Color = Neon.Accent,
    radius: Dp = 14.dp,
    strong: Boolean = false,
): Modifier = composed {
    val shift by rememberInfiniteTransition(label = "neonSweep").animateFloat(
        initialValue = 1.8f, targetValue = -0.6f,
        animationSpec = infiniteRepeatable(tween(7000, easing = LinearEasing), RepeatMode.Restart),
        label = "sweep",
    )
    val glows = if (strong) listOf(1.dp to 0.26f, 22.dp to 0.45f, 60.dp to 0.20f)
                else listOf(1.dp to 0.18f, 16.dp to 0.34f, 44.dp to 0.14f)
    val inset = if (strong) 0.14f else 0.10f
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(radius)

    this
        .drawWithCache {
            val r = radius.toPx()
            val paints = glows.map { (blur, a) ->
                Paint().asFrameworkPaint().apply {
                    isAntiAlias = true
                    color = android.graphics.Color.TRANSPARENT
                    setShadowLayer(blur.toPx(), 0f, 0f, accent.copy(alpha = a).toArgb())
                }
            }
            onDrawBehind {
                drawIntoCanvas { c ->
                    paints.forEach { p ->
                        p.color = Neon.Surface.copy(alpha = 0.01f).toArgb()
                        c.nativeCanvas.drawRoundRect(0f, 0f, size.width, size.height, r, r, p)
                    }
                }
                drawRoundRect(Neon.Surface.copy(alpha = 0.65f), cornerRadius = CornerRadius(r))
            }
        }
        .clip(shape)
        .drawWithCache {
            val r = radius.toPx()
            val innerPaint = Paint().asFrameworkPaint().apply {
                isAntiAlias = true
                style = android.graphics.Paint.Style.STROKE
                strokeWidth = 20.dp.toPx()
                color = accent.copy(alpha = inset).toArgb()
                maskFilter = BlurMaskFilter(10.dp.toPx(), BlurMaskFilter.Blur.NORMAL)
            }
            onDrawWithContent {
                drawContent()
                drawIntoCanvas { it.nativeCanvas.drawRoundRect(0f, 0f, size.width, size.height, r, r, innerPaint) }
                val w = size.width * 2.6f
                val startX = shift * size.width - w / 2f
                drawRect(
                    Brush.linearGradient(
                        0f to Color.Transparent, 0.32f to Color.Transparent,
                        0.46f to accent.copy(alpha = 0.28f),
                        0.60f to Color.Transparent, 1f to Color.Transparent,
                        start = Offset(startX, 0f),
                        end = Offset(startX + w, size.height * 0.47f),
                    )
                )
                drawRoundRect(
                    accent.copy(alpha = 0.55f), cornerRadius = CornerRadius(r),
                    style = Stroke(1.5.dp.toPx()),
                )
            }
        }
}

/** Glow levels for text: account number, broker, values/holder. */
object NeonText {
    fun login(accent: Color = Neon.Accent) = TextStyle(
        color = lerp(Color.White, accent, 0.45f),
        shadow = Shadow(accent.copy(alpha = 0.75f), blurRadius = 16f),
    )
    fun broker(accent: Color = Neon.Accent) = TextStyle(shadow = Shadow(accent.copy(alpha = 0.45f), blurRadius = 20f))
    fun value(accent: Color = Neon.Accent) = TextStyle(shadow = Shadow(accent.copy(alpha = 0.30f), blurRadius = 16f))
}

/** Wrap a status icon: green pulsing when connected, steady red otherwise. */
@Composable
fun NeonStatus(connected: Boolean, content: @Composable BoxScope.() -> Unit) {
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        1f, 0.55f, infiniteRepeatable(tween(1100, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "a",
    )
    val color = if (connected) Neon.Success else Neon.Danger
    Box(
        Modifier
            .alpha(if (connected) pulse else 1f)
            .drawWithCache {
                val p = Paint().asFrameworkPaint().apply {
                    isAntiAlias = true
                    this.color = color.copy(alpha = 0.5f).toArgb()
                    maskFilter = BlurMaskFilter(14.dp.toPx(), BlurMaskFilter.Blur.NORMAL)
                }
                onDrawBehind {
                    drawIntoCanvas { it.nativeCanvas.drawCircle(size.width / 2, size.height / 2, size.minDimension / 2, p) }
                }
            },
        content = content,
    )
}
