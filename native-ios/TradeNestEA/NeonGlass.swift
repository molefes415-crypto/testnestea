import SwiftUI

/// Presentation-only neon glass look matching the web app. One accent recolours everything.
extension Color {
    static let neonAccent = Color(red: 0.61, green: 0.36, blue: 1.0)
    static let neonBackground = Color(red: 0.04, green: 0.03, blue: 0.08)
    static let neonSuccess = Color(red: 0.13, green: 0.77, blue: 0.37)
    static let neonDanger = Color(red: 0.94, green: 0.27, blue: 0.27)
}

struct NeonCard: ViewModifier {
    var accent: Color = .neonAccent
    var radius: CGFloat = 14
    var strong: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var sweep = false

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        content
            .background(ZStack { shape.fill(.ultraThinMaterial); shape.fill(Color.black.opacity(0.35)) })
            .overlay(
                shape.stroke(accent.opacity(strong ? 0.14 : 0.10), lineWidth: 20)
                    .blur(radius: 10).clipShape(shape).allowsHitTesting(false)
            )
            .overlay(
                GeometryReader { geo in
                    let w = geo.size.width * 2.6
                    LinearGradient(stops: [
                        .init(color: .clear, location: 0.32),
                        .init(color: accent.opacity(0.28), location: 0.46),
                        .init(color: .clear, location: 0.60),
                    ], startPoint: .topLeading, endPoint: .bottomTrailing)
                    .frame(width: w)
                    .offset(x: sweep ? -w : geo.size.width)
                    .opacity(reduceMotion ? 0 : 1)
                }
                .clipShape(shape).allowsHitTesting(false)
            )
            .overlay(shape.stroke(accent.opacity(0.55), lineWidth: 1.5))
            .shadow(color: accent.opacity(strong ? 0.26 : 0.18), radius: 1)
            .shadow(color: accent.opacity(strong ? 0.45 : 0.34), radius: strong ? 11 : 8)
            .shadow(color: accent.opacity(strong ? 0.20 : 0.14), radius: strong ? 30 : 22)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 7).repeatForever(autoreverses: false)) { sweep = true }
            }
    }
}

extension View {
    func neonCard(strong: Bool = false, accent: Color = .neonAccent) -> some View {
        modifier(NeonCard(accent: accent, strong: strong))
    }
    /// Account number glow.
    func neonLogin(_ accent: Color = .neonAccent) -> some View {
        foregroundStyle(accent.mix(with: .white, by: 0.55))
            .shadow(color: accent.opacity(0.75), radius: 4)
            .shadow(color: accent.opacity(0.45), radius: 11)
    }
    func neonBroker(_ accent: Color = .neonAccent) -> some View { shadow(color: accent.opacity(0.45), radius: 5) }
    func neonValue(_ accent: Color = .neonAccent) -> some View { shadow(color: accent.opacity(0.30), radius: 4) }
}

/// Green pulsing icon when connected, steady red otherwise.
struct NeonStatusIcon: View {
    let connected: Bool
    @State private var dim = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let c: Color = connected ? .neonSuccess : .neonDanger
        Image(systemName: connected ? "checkmark.circle.fill" : "xmark.circle.fill")
            .foregroundStyle(c)
            .shadow(color: c.opacity(0.85), radius: 2.5)
            .shadow(color: c.opacity(0.5), radius: 7)
            .opacity(connected && dim ? 0.55 : 1)
            .onAppear {
                guard connected, !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 1.1).repeatForever()) { dim = true }
            }
    }
}
