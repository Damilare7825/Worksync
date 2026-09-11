import React from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { BookOpen, MessageSquare, Shield } from 'lucide-react';

export function HelpCenter() {
  const faqs = [
    {
      icon: BookOpen,
      title: 'Getting Started',
      description: 'Learn how to set up your workspace, create projects, and invite team members.',
    },
    {
      icon: MessageSquare,
      title: 'Support',
      description: 'Contact our support team for help with billing, account issues, or technical problems.',
    },
    {
      icon: Shield,
      title: 'Security',
      description: 'Understand how we protect your data with encryption, access controls, and audit logging.',
    },
  ];

  return (
    <AppLayout title="Help Center" subtitle="Find answers and get support">
      <div className="flex flex-col w-full h-full p-8 gap-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#e5e2e3] tracking-tight">Help Center</h1>
          <p className="text-sm text-[#cbc3d7] mt-1">How can we help you today?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {faqs.map((faq) => (
            <div
              key={faq.title}
              className="bg-[#201f20] rounded-2xl p-6 border border-[#353436]/40 hover:border-[#a078ff]/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[#2a2a2b] flex items-center justify-center text-[#d0bcff] mb-4">
                <faq.icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#e5e2e3] mb-2">{faq.title}</h3>
              <p className="text-xs text-[#cbc3d7] leading-relaxed">{faq.description}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
