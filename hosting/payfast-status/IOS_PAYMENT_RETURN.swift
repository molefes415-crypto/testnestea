import Foundation

// Native iOS integration only. Add-to-Home-Screen web apps cannot register URL schemes.
struct TradeNestPaymentStatus: Decodable {
    let payment_id: String?
    let status: String?
    let paid: Bool
}

@MainActor
final class TradeNestPaymentReturn {
    private let key = "tradenest_pending_payment"

    func rememberCheckout(_ paymentId: String) {
        UserDefaults.standard.set(paymentId, forKey: key)
    }

    // Use from .onOpenURL and whenever scenePhase becomes .active.
    func verifyReturn(_ incoming: URL? = nil) async -> Bool {
        guard let expected = UserDefaults.standard.string(forKey: key) else { return false }
        if let incoming {
            guard incoming.scheme == "tradenest", incoming.host == "payfast",
                  URLComponents(url: incoming, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "payment_id" })?.value == expected else { return false }
        }
        var components = URLComponents(string: "https://tradenestea.com/admin/api/payfast_status.php")
        components?.queryItems = [URLQueryItem(name: "payment_id", value: expected)]
        guard let url = components?.url else { return false }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return false }
            let result = try JSONDecoder().decode(TradeNestPaymentStatus.self, from: data)
            return result.payment_id == expected && result.status == "paid" && result.paid
        } catch { return false }
    }
}