import { afterEach, describe, expect, it, vi } from "vitest";
import { suggestConsultationQuestions } from "./aiProvider";
afterEach(() => vi.unstubAllGlobals());
describe("consultation AI suggestions", () => {
  it("uses the requesting member's key and returns suggestions for review", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ questions: ["كيف نختبر الطلب؟"] }),
                },
              },
            ],
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      suggestConsultationQuestions({
        apiKey: "member-key",
        model: "member-model",
        context: "سياق الفكرة",
      })
    ).resolves.toEqual(["كيف نختبر الطلب؟"]);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe(
      "Bearer member-key"
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(
      "member-model"
    );
  });
  it("rejects malformed suggestions", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"questions":[123]}' } }],
            }),
            { status: 200 }
          )
        )
    );
    await expect(
      suggestConsultationQuestions({
        apiKey: "key",
        model: "model",
        context: "فكرة",
      })
    ).rejects.toThrow("أسئلة صالحة");
  });
});
