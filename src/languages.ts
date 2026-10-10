export const LANGUAGES: Record<string, string> = {
    af: "Afrikaans", ar: "Arabic", zh: "Chinese", en: "English",
    es: "Spanish", fa: "Persian", hi: "Hindi", id: "Indonesian",
    kk: "Kazakh", ms: "Malay", pt: "Portuguese", ru: "Russian",
    sw: "Swahili", th: "Thai", uz: "Uzbek", vi: "Vietnam"
};

export function getAllowedTargets(source: string): string[] {
    if (source === "en" || source === "hi") {
        return Object.keys(LANGUAGES).filter(code => code !== source);
    }
    return ["en", "hi"];
}