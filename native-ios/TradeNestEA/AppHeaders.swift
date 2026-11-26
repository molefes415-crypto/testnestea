import Foundation

/// Adds the v2 app headers that the tradenestea.com PHP APIs check.
/// Use `TradeNestAPI.request(...)` for every call to /admin/api/.
enum TradeNestAPI {
    static let baseURL = URL(string: "https://tradenestea.com/admin/api/")!
    static let appSignature = "TN-EA-V2-SECURE-SECRET-9981"
    static let appVersion = "2.0.0"

    static let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 30
        c.timeoutIntervalForResource = 200
        return URLSession(configuration: c)
    }()

    static func request(_ path: String, method: String = "GET",
                        json: [String: Any]? = nil,
                        mt5Token: String? = nil,
                        timeout: TimeInterval = 30) -> URLRequest {
        var r = URLRequest(url: URL(string: path, relativeTo: baseURL)!)
        r.httpMethod = method
        r.timeoutInterval = timeout
        r.setValue(appSignature, forHTTPHeaderField: "X-App-Signature")
        r.setValue(appVersion, forHTTPHeaderField: "X-App-Version")
        if let t = mt5Token { r.setValue(t, forHTTPHeaderField: "X-MT5-Token") }
        if let json {
            r.setValue("application/json", forHTTPHeaderField: "Content-Type")
            r.httpBody = try? JSONSerialization.data(withJSONObject: json)
        }
        return r
    }

    /// Sends the request; a 403 means the server says this app version is too old.
    static func send(_ r: URLRequest) async throws -> Data {
        let (data, resp) = try await session.data(for: r)
        if (resp as? HTTPURLResponse)?.statusCode == 403 {
            throw NSError(domain: "TradeNest", code: 403,
                userInfo: [NSLocalizedDescriptionKey: "Old app version. Update to v2.0."])
        }
        return data
    }
}

// Example:
// let data = try await TradeNestAPI.send(
//     TradeNestAPI.request("mt5_gateways.php?a=proxy&p=account", mt5Token: token))
