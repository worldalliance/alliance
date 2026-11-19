# Evidence

## Choosing an agent, and signing in to several

Question: how do apps that run several coding agents present the choice of agent per conversation, its default, and each provider's sign-in, and what do platform guidelines say about a two-option control? Researched by a subagent, checked 2026-11-18.

- VS Code chooses the agent before the first prompt, and a chat keeps its agent ("Each chat retains its harness, model, and permission settings"); it documents no default agent. Vendor documentation. https://code.visualstudio.com/docs/agents/run/sessions/manage-sessions
- Conductor fixes one agent per chat tab ("Each chat tab uses one harness and one selected model"). Vendor documentation. https://www.conductor.build/docs/reference/harnesses
- Zed starts an external agent's thread from an agent selector, and each agent owns its own sign-in ("Claude Agent owns its own authentication and billing"). Vendor documentation. https://zed.dev/docs/ai/external-agents
- None of these gates the whole app behind one provider's sign-in; a provider not set up blocks only its own agent. Common practice, the researcher's synthesis of the three sources above.
- Cursor has a "Last Used" default model setting, per a staff reply on its forum. Common practice, and about models rather than agents. https://forum.cursor.com/t/cursor-ai-agent-constantly-reverts-to-auto-model/158663
- Users mostly keep defaults, so a default should be what most people want. Research-backed practice. https://www.nngroup.com/articles/the-power-of-defaults/
- "Do not use drop-down lists with fewer than three items"; use radio or toggle buttons for two. Vendor recommendation (GNOME HIG). https://developer.gnome.org/hig/patterns/controls/drop-downs.html
- A pop-up button should "provide a useful default selection… an item that most people are likely to want". Vendor recommendation (Apple HIG). https://developer.apple.com/design/human-interface-guidelines/pop-up-buttons
