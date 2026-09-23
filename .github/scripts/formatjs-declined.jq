.[] | select(.state == "closed" and all(.labels[]; .name != "superseded")) | .number
