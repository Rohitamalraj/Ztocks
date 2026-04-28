"use client";

import { ArrowUpRight } from "lucide-react";
import { AnimatedWave } from "./animated-wave";
import Link from "next/link";

const footerLinks = {
  Protocol: [
    { name: "Features", href: "#features" },
    { name: "How it works", href: "#how-it-works" },
    { name: "Security", href: "#security" },
    { name: "Smart Contracts", href: "#" },
  ],
  Developers: [
    { name: "Documentation", href: "#" },
    { name: "GitHub", href: "#" },
    { name: "Sepolia Docs", href: "#" },
    { name: "SUPRA Oracle", href: "#" },
  ],
  Sepolia: [
    { name: "Sepolia", href: "#" },
    { name: "Etherscan", href: "#" },
    { name: "Explorer", href: "#" },
  ],
  Legal: [
    { name: "Privacy", href: "#" },
    { name: "Terms", href: "#" },
    { name: "Disclaimer", href: "#" },
  ],
};

const socialLinks = [
  { name: "Twitter", href: "#" },
  { name: "GitHub", href: "#" },
  { name: "Discord", href: "#" },
];

export function FooterSection() {
  return (
    <footer className="relative border-t border-foreground/10">
      <div className="absolute inset-0 h-64 opacity-20 pointer-events-none overflow-hidden">
        <AnimatedWave />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="py-16 lg:py-24">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-12 lg:gap-8">
            <div className="col-span-2">
              <a href="#" className="inline-flex items-center gap-2 mb-6">
                <span className="text-2xl font-display">Ztocks</span>
                <span className="text-xs text-muted-foreground font-mono">CONFIDENTIAL</span>
              </a>
              <p className="text-muted-foreground leading-relaxed mb-8 max-w-xs">
                Privacy-preserving synthetic stock trading, governed by zk identity and tier-based leverage on Sepolia.
              </p>
              <div className="flex gap-6">
                {socialLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
                  >
                    {link.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </a>
                ))}
              </div>
            </div>

            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="text-sm font-medium mb-6">{title}</h3>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="py-8 border-t border-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            2026 Ztocks. Built for confidential synthetic trading.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/trade" className="hover:text-foreground transition-colors font-mono text-xs">
              Launch App →
            </Link>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Testnet live
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
