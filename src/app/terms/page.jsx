"use client";

import React from 'react';
import Link from 'next/link';

const EFFECTIVE_DATE = "February 2026";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#ffffff' }}>
      {/* Green accent line at top */}
      <div className="h-1" style={{ backgroundColor: '#00684A' }} />

      {/* Title Section */}
      <header className="py-12 md:py-16" style={{ backgroundColor: '#ffffff' }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="text-3xl md:text-4xl font-normal mb-6" style={{ color: '#00684A' }}>
            Terms of Service
          </h1>
          <p className="text-sm italic" style={{ color: '#4b5563' }}>
            These Terms of Service were last revised on {EFFECTIVE_DATE}.
          </p>
        </div>
      </header>

      {/* Divider */}
      <div style={{ borderBottom: '1px solid #e5e7eb' }} />

      {/* Content */}
      <div role="main" className="max-w-3xl mx-auto px-6 py-10 md:py-12" style={{ backgroundColor: '#ffffff' }}>
        <div className="text-[15px] leading-relaxed" style={{ color: '#374151' }}>
          <p className="mb-8">
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of MongoDB&apos;s
            Healthcare Data Lab (the &quot;Demo Portal&quot;). The Demo Portal is provided by MongoDB, Inc.
            (&quot;MongoDB,&quot; &quot;we,&quot; or &quot;us&quot;). By accessing or using the Demo Portal, you agree to
            these Terms as well as MongoDB&apos;s{' '}
            <a
              href="https://www.mongodb.com/legal/terms-of-use"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: '#00684A' }}
            >
              Terms of Use
            </a>
            . If you do not agree, do not use the Demo Portal.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            1. Purpose and Nature of the Demo Portal.
          </h2>
          <p className="mb-6">
            The Demo Portal is an experimental, non-production environment for demonstration
            purposes only. It is not an official MongoDB product and is not formally supported
            by MongoDB. MongoDB makes no representation or warranty as to the accuracy, adequacy,
            completeness, and fitness for a particular purpose in respect of any materials made
            available through the Demo Portal.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            2. No Production or Sensitive Data.
          </h2>
          <p className="mb-6">
            Do not upload, input, or connect the Demo Portal to production systems or real
            customer environments. Do not use the Demo Portal with confidential, proprietary,
            regulated, or otherwise sensitive data. If you choose to provide data, you are
            responsible for ensuring it is synthetic, anonymized, and non-sensitive.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            3. Access and Use.
          </h2>
          <p className="mb-6">
            You may use the Demo Portal only in accordance with these Terms and any on-screen
            instructions. You must comply with applicable laws and respect the rights of others.
            You may not attempt to bypass security, interfere with the Demo Portal&apos;s operation,
            test for vulnerabilities without express written permission, reverse engineer
            components, or use the Demo Portal to develop or train models or systems for
            unlawful or harmful purposes.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            4. Ownership and Feedback.
          </h2>
          <p className="mb-6">
            MongoDB and its licensors own all rights in the Demo Portal and all related software,
            content, and materials. Using the Demo Portal does not transfer any intellectual
            property rights to you, except as expressly set forth herein. If you provide feedback,
            ideas, or suggestions about the Demo Portal, you grant MongoDB a worldwide, perpetual,
            irrevocable, royalty-free license to use, copy, modify, and commercialize that feedback
            without any obligation to you.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            5. Licensing of Data Strategies.
          </h2>
          <p className="mb-6">
            Certain sample data strategies, templates, schemas, or similar design artifacts made
            available through the Demo Portal and expressly labeled as &quot;CC BY 4.0&quot; (collectively,
            the &quot;Data Strategies&quot;) are licensed by MongoDB to you under the{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline" style={{ color: '#00684A' }}
            >
              Creative Commons Attribution 4.0 International license (CC BY 4.0)
            </a>
            . You may use, share, adapt, and build upon the Data Strategies, provided that you
            give appropriate attribution. This license applies only to the Data Strategies that
            are explicitly identified as such and does not apply to the Demo Portal software,
            services, or other MongoDB content.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            6. Contributions to Data Strategies.
          </h2>
          <p className="mb-6">
            If you submit, upload, or propose changes, additions, or new versions to the Data
            Strategies through the Demo Portal (each, a &quot;Contribution&quot;), you agree to license
            your Contribution to MongoDB and to the public under CC BY 4.0, without any
            additional terms or restrictions.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            7. Your Content.
          </h2>
          <p className="mb-6">
            If you upload or input content into the Demo Portal, you grant MongoDB a worldwide,
            nonexclusive, royalty-free license to host, use, reproduce, and display that content
            to operate and improve the Demo Portal. For content that constitutes a Contribution
            to the Data Models (as described above), you also agree that such content is licensed
            to MongoDB and to the public under CC BY 4.0. You represent that you have the rights
            needed to grant these licenses and that your content does not violate law or the
            rights of others. MongoDB may remove content at any time. We may delete your content
            at any time and have no obligation to maintain backups or to return content.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            8. Privacy and Data Handling.
          </h2>
          <p className="mb-6">
            MongoDB may collect information about your use of the Demo Portal, including technical
            logs, usage data, and configuration details, to operate, secure, and improve the Demo
            Portal. Any personal information we collect will be handled in accordance with MongoDB&apos;s{' '}
            <a
              href="https://www.mongodb.com/legal/privacy/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline" style={{ color: '#00684A' }}
            >
              Privacy Policy
            </a>
            .
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            9. No Support or Service Levels.
          </h2>
          <p className="mb-6">
            MongoDB does not provide support or service-level agreements for the Demo Portal.
            Features may be incomplete or unavailable. The Demo Portal may be suspended or
            terminated at any time.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            10. No Warranties.
          </h2>
          <p className="mb-6">
            The Demo Portal is provided &quot;as is&quot; and &quot;as available.&quot; To the fullest extent
            permitted by law, MongoDB disclaims all warranties, whether express, implied,
            statutory, or otherwise, including warranties of merchantability, fitness for a
            particular purpose, title, noninfringement, and quiet enjoyment, as well as any
            warranties arising from course of dealing or usage of trade.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            11. Limitations of Liability.
          </h2>
          <p className="mb-6">
            To the fullest extent permitted by law, MongoDB will not be liable for any indirect,
            incidental, special, consequential, exemplary, or punitive damages, or for lost
            profits, lost revenues, lost data, business interruption, or replacement costs,
            even if advised of the possibility of such damages. MongoDB&apos;s total liability for
            all claims arising out of or relating to the Demo Portal will not exceed one hundred
            U.S. dollars ($100).
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            12. Indemnification.
          </h2>
          <p className="mb-6">
            You will defend, indemnify, and hold harmless MongoDB and its affiliates, and their
            respective officers, directors, employees, and agents from and against any claims,
            damages, liabilities, costs, and expenses (including reasonable attorneys&apos; fees)
            arising from your use of the Demo Portal, your content, or your violation of these
            Terms or applicable law.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            13. Suspension and Termination.
          </h2>
          <p className="mb-6">
            MongoDB may suspend or terminate your access to the Demo Portal at any time, with
            or without notice, for any reason. You may stop using the Demo Portal at any time.
            Upon termination, your right to access the Demo Portal ends immediately, and we may
            delete your content without notice.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            14. Changes to the Demo and to these Terms.
          </h2>
          <p className="mb-6">
            MongoDB may change the Demo Portal or these Terms at any time. If we make material
            changes to the Terms, we may provide notice by posting the updated Terms in the Demo
            Portal. Changes will be effective when posted. Your continued use of the Demo Portal
            after changes become effective means you accept the updated Terms.
          </p>

          <h2 className="text-lg md:text-xl font-normal mt-8 mb-4" style={{ color: '#00684A' }}>
            15. Governing Law and Dispute Resolution.
          </h2>
          <p className="mb-6">
            These Terms are governed by the laws of the State of New York, U.S.A., without
            regard to conflict of laws rules. Any disputes arising out of or relating to the
            Demo Portal or these Terms will be resolved exclusively in the state or federal
            courts located in New York County, New York, and the parties consent to personal
            jurisdiction and venue in those courts.
          </p>

          {/* Trademark Notices */}
          <div className="pt-8 mt-8" style={{ borderTop: '1px solid #e5e7eb' }}>
            <h2 className="text-lg md:text-xl font-normal mb-4" style={{ color: '#00684A' }}>
              Trademark Notices.
            </h2>
            <p className="mb-4">
              HL7 and FHIR are the registered trademarks of Health Level Seven International
              and their use does not constitute endorsement by HL7.
            </p>
            <p>
              openEHR is the registered trademark of the openEHR Foundation and use of the
              mark does not constitute endorsement by openEHR International or openEHR Foundation.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8" style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
        <div className="max-w-3xl mx-auto px-6 py-8 text-center">
          <p className="text-sm" style={{ color: '#6b7280' }}>
            &copy; {new Date().getFullYear()} MongoDB, Inc. All rights reserved.
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="text-sm underline"
              style={{ color: '#00684A' }}
            >
              Return to Healthcare Data Lab
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
