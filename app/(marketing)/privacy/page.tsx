import { Footer } from "@/components/footer";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy | Vidzee",
  description: "Privacy Policy for Vidzee, an AI-powered real estate video creation platform by Antimatter AI LLC.",
};

export default function PrivacyPage(): ReactNode {
  return (
    <>
      <main className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-neutral-500 mb-12">Last updated: February 22, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Antimatter AI LLC (&quot;we,&quot; &quot;us,&quot; or &quot;the Company&quot;) operates
              Vidzee, an AI-powered real estate video creation platform. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use
              our Service. By using Vidzee, you consent to the practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong>Account Information:</strong> Email address, name, and authentication
                credentials when you create an account.
              </li>
              <li>
                <strong>User Content:</strong> Photos and other media you upload to create videos.
              </li>
              <li>
                <strong>Payment Information:</strong> Billing details processed securely through
                Stripe. We do not store your full credit card number on our servers.
              </li>
              <li>
                <strong>Usage Data:</strong> Information about how you interact with the Service,
                including pages visited, features used, and timestamps.
              </li>
              <li>
                <strong>Device Information:</strong> Browser type, operating system, IP address, and
                device identifiers collected automatically.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide, maintain, and improve the Service.</li>
              <li>Process your transactions and manage your credit balance.</li>
              <li>Generate AI-powered videos from your uploaded content.</li>
              <li>Communicate with you about your account, updates, and support requests.</li>
              <li>Monitor and analyze usage trends to improve user experience.</li>
              <li>Detect, prevent, and address fraud, abuse, or technical issues.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
            <p>
              We use the following third-party services to operate Vidzee. Each service has its own
              privacy policy governing the use of your data:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong>Supabase:</strong> Authentication, database, and file storage.
              </li>
              <li>
                <strong>Stripe:</strong> Payment processing. Stripe collects and processes payment
                information in accordance with its own privacy policy.
              </li>
              <li>
                <strong>Fal.ai:</strong> AI model inference for video generation. Uploaded photos
                may be sent to Fal.ai for processing.
              </li>
              <li>
                <strong>Vercel:</strong> Hosting and deployment infrastructure.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
            <p>
              We retain your account information for as long as your account is active. Uploaded
              photos and generated videos are stored for the duration of your account and may be
              deleted upon account termination. Payment records are retained as required by
              applicable tax and financial regulations. You may request deletion of your data at any
              time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your information,
              including encryption in transit (TLS) and at rest. However, no method of electronic
              transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate or incomplete data.</li>
              <li>Request deletion of your personal data.</li>
              <li>Object to or restrict certain processing of your data.</li>
              <li>Request a portable copy of your data.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please contact us at the email address below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies</h2>
            <p>
              We use essential cookies to maintain your authentication session and preferences. We
              do not use third-party advertising or tracking cookies. By using the Service, you
              consent to the use of essential cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Children&apos;s Privacy</h2>
            <p>
              The Service is not intended for use by individuals under the age of 18. We do not
              knowingly collect personal information from children. If we become aware that we have
              collected data from a child, we will take steps to delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by posting the updated policy on this page with a revised &quot;Last
              updated&quot; date. Your continued use of the Service after any changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:atom@antimatterai.com" className="text-accent hover:underline">
                atom@antimatterai.com
              </a>
              .
            </p>
            <p className="mt-2">
              Antimatter AI LLC
              <br />
              Georgia, United States
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
