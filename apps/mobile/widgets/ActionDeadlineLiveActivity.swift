import ActivityKit
import SwiftUI
import WidgetKit

struct ActionDeadlineLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ActionDeadlineAttributes.self) { context in
            // Lock screen / banner presentation
            lockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(timerInterval: Date()...Date(timeIntervalSince1970: context.attributes.deadline), countsDown: true)
                            .monospacedDigit()
                    } icon: {
                        Image(systemName: "timer")
                    }
                    .font(.caption)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.completedCount)/\(context.attributes.totalCount)")
                        .font(.caption)
                        .fontWeight(.semibold)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(context.attributes.actionName)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .lineLimit(1)
                        ProgressView(
                            value: Double(context.state.completedCount),
                            total: Double(max(context.attributes.totalCount, 1))
                        )
                        .tint(.blue)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Text(timerInterval: Date()...Date(timeIntervalSince1970: context.attributes.deadline), countsDown: true)
                    .monospacedDigit()
                    .font(.caption)
                    .frame(width: 48)
            } compactTrailing: {
                Text("\(context.state.completedCount)/\(context.attributes.totalCount)")
                    .font(.caption)
                    .fontWeight(.semibold)
            } minimal: {
                Text(timerInterval: Date()...Date(timeIntervalSince1970: context.attributes.deadline), countsDown: true)
                    .monospacedDigit()
                    .font(.caption)
            }
        }
    }

    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<ActionDeadlineAttributes>) -> some View {
        let deadlineDate = Date(timeIntervalSince1970: context.attributes.deadline)
        let progress = Double(context.state.completedCount) / Double(max(context.attributes.totalCount, 1))

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(context.attributes.actionName)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(1)
                Spacer()
                Text(timerInterval: Date()...deadlineDate, countsDown: true)
                    .monospacedDigit()
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .multilineTextAlignment(.trailing)
            }

            ProgressView(value: progress)
                .tint(.blue)

            HStack {
                Text("\(context.state.completedCount) of \(context.attributes.totalCount) completed")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
            }
        }
        .padding()
    }
}
