import { Footer } from "@/components/footer";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terms of Service | Vidzee",
  description: "Terms of Service for Vidzee, an AI-powered real estate video creation platform by Antimatter AI LLC.",
};

export default function TermsPage(): ReactNode {
  return (
    <>
      <main className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-neutral-500 mb-12">Last updated: February 22, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Vidzee (&quot;the Service&quot;), operated by Antimatter AI LLC
              (&quot;we,&quot; &quot;us,&quot; or &quot;the Company&quot;), you agree to be bound by
              these Terms of Service. If you do not agree to these terms, you may not use the
              Service. We reserve the right to update these terms at any time, and continued use of
              the Service constitutes acceptance of any modifications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p>
              Vidzee is an AI-powered platform that generates real estate listing videos from
              property photos. Users upload photos of a property, select a style and transitions,
              and the Service uses artificial intelligence to produce a short-form video suitable for
              marketing and social media.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Account Registration</h2>
            <p>
              You must create an account to use the Service. You are responsible for maintaining the
              confidentiality of your login credentials and for all activity that occurs under your
              account. You agree to provide accurate and complete information during registration and
              to update it as necessary.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Credits, Billing &amp; Refunds</h2>
            <p>
              The Service operates on a credit-based system. Credits are purchased through Stripe and
              are consumed when you generate a video. Credit purchases are final and
              non-refundable. Unused credits do not expire. Pricing is subject to change; however,
              credits already purchased will be honored at the rate at which they were bought.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. User Content</h2>
            <p>
              You retain ownership of the photos and other content you upload to the Service
              (&quot;User Content&quot;). By uploading User Content, you grant us a limited,
              non-exclusive, royalty-free license to process, store, and transform your content
              solely for the purpose of providing the Service. We do not claim ownership of your
              User Content and will not use it for purposes unrelated to the Service without your
              consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. AI-Generated Content</h2>
            <p>
              Videos produced by the Service are generated using artificial intelligence. While we
              strive for high quality, AI-generated content may contain imperfections, artifacts, or
              inaccuracies. You are solely responsible for reviewing all generated videos before
              using them in any marketing or public-facing context. We make no warranty that
              AI-generated content will be error-free or suitable for any particular purpose.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Upload content that infringes on the intellectual property rights of others.</li>
              <li>Attempt to reverse-engineer, decompile, or disassemble any part of the Service.</li>
              <li>Use automated scripts or bots to access the Service without prior written consent.</li>
              <li>Upload harmful, offensive, or misleading content.</li>
              <li>Resell or redistribute access to the Service without authorization.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
            <p>
              The Service, including its design, code, branding, and AI models, is the intellectual
              property of Antimatter AI LLC. You may not copy, modify, or distribute any part of the
              Service without our express written permission. You are granted a limited license to
              use videos generated by the Service for your own commercial real estate marketing
              purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Antimatter AI LLC shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, including but not
              limited to loss of profits, data, or business opportunities, arising out of or related
              to your use of the Service. Our total liability for any claim arising from the Service
              shall not exceed the amount you paid to us in the twelve (12) months preceding the
              claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without
              warranties of any kind, whether express or implied, including but not limited to
              implied warranties of merchantability, fitness for a particular purpose, and
              non-infringement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Termination</h2>
            <p>
              We may suspend or terminate your account at any time, with or without cause, and with
              or without notice. Upon termination, your right to use the Service ceases immediately.
              Any credits remaining in your account at the time of termination are forfeited and
              non-refundable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              State of Georgia, United States, without regard to its conflict of law provisions. Any
              disputes arising under these Terms shall be resolved in the state or federal courts
              located in Georgia.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Contact</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at{" "}
              <a href="mailto:atom@antimatterai.com" className="text-accent hover:underline">
                atom@antimatterai.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
