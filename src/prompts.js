import PromptSync from "prompt-sync";

const prompt = PromptSync({ sigint: true });

export function ask(question) {
	while (true) {
		const answer = prompt(question);
		if (answer === null) throw new Error("No input available");
		if (answer.trim()) return answer.trim();
	}
}
