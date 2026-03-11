import ActivityKit
import Foundation

struct ActionDeadlineAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var completedCount: Int
    }

    var actionName: String
    var deadline: Double // unix seconds
    var totalCount: Int
}
