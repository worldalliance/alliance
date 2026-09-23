.[] | select(.isCrossRepository | not) | select(.state != "OPEN" and all(.labels[]; .name != "superseded")) | .number
