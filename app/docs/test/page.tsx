"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";

interface Response {
  email: string;
  message: string;
}

export default function EmailTestPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [response, setResponse] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    setResponse(null);

    if (!token) {
      alert("Please complete the CAPTCHA");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_SERVER_URL as string) + "api/email-test",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "cf-token": token,
            recipient: email,
            email,
          }),
        }
      );
      const data = (await res.json()) as Response;
      setResponse(data);

      await new Promise((r) => setTimeout(r, 800));
    } finally {
      setLoading(false);
    }
  }

  const Strategy = ({ title, body }: { title: string; body: React.ReactNode }) => (
    <div className="rounded-[0.33em] border border-[#e0e0e0] bg-white p-[14px]">
      <div className="mb-[6px] font-semibold text-[#202124]">{title}</div>
      <div className="text-[14px] leading-[1.65] text-[#3c4043]">{body}</div>
    </div>
  );

  return (
    <main className="flex min-h-full w-full flex-1 bg-white font-sans text-[#202124]">
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mb-[30px] w-full text-center text-[44px] leading-none font-bold tracking-[-0.5px] select-none">
          <span className="text-primary">BetterInternship</span>
        </div>

        <form className="w-full max-w-3xl" onSubmit={(e) => void sendTestEmail(e)}>
          {token ? (
            <div className="flex w-full items-center gap-3 rounded-[0.33em] border border-[#dfe1e5] px-4 py-[6px] pr-[6px] shadow-[0_1px_4px_rgba(32,33,36,0.16)]">
              <input
                type="email"
                placeholder="Enter your email to receive a test message"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="min-w-0 flex-1 border-none bg-transparent text-[18px] outline-none"
              />

              <Button
                disabled={loading}
                className="bg-primary shrink-0 rounded-[0.33em] px-6"
                size="md"
              >
                {loading ? "Sending..." : "Send email"}
              </Button>
            </div>
          ) : (
            <div className="relative flex w-full flex-col items-center">
              <Loader>Validating browser...</Loader>
              <Turnstile
                siteKey={process.env.NEXT_PUBLIC_MOA_SERVER_API_KEY_TURNSTILE!}
                onSuccess={(t) => setToken(t)}
                onError={() => setToken("")}
              />
            </div>
          )}
        </form>

        {response && (
          <div className="text-primary mt-[18px] text-center text-[15px]">{response.message}</div>
        )}

        {token && (
          <div className="mt-[42px] w-full max-w-3xl">
            <details className="rounded-[0.33em] border border-[#e0e0e0] bg-[#fafafa] p-[14px]">
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-[#202124] outline-none select-none">
                Not receiving the email?
                <span className="font-medium text-[#5f6368]"> (click to expand)</span>
              </summary>

              <div className="mt-3 grid gap-3">
                <Strategy
                  title="Check Spam Folder"
                  body={
                    <>
                      Look in <strong>Spam</strong> / <strong>Junk</strong>. If you find it, mark it
                      as <strong>Not spam</strong>.
                    </>
                  }
                />
                <Strategy
                  title="Allow-list Our Sender"
                  body={
                    <>
                      Add <strong>hello@betterinternship.com</strong> to your contacts or allow list
                      (safe senders).
                    </>
                  }
                />
                <Strategy
                  title="Search Everywhere"
                  body={
                    <>
                      Search your inbox for "BetterInternship" and check "All Mail" / "Archive" /
                      "Other" depending on your email client.
                    </>
                  }
                />
                <Strategy
                  title="Corporate Email Filters"
                  body={
                    <>
                      If you're using a work email, your company may block unknown senders. Ask IT
                      to check quarantine and allow our sender / domain.
                    </>
                  }
                />
                <Strategy
                  title="Try a Different Email Address"
                  body={
                    <>
                      Test with a personal email (like Gmail) to confirm whether it's specific to
                      corporate filtering.
                    </>
                  }
                />
              </div>
            </details>
          </div>
        )}
      </section>
    </main>
  );
}
