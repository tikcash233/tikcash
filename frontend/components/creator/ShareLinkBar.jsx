import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link as LinkIcon, Copy, Share2, ExternalLink } from "lucide-react";

export default function ShareLinkBar({ creator }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const handle = (creator?.tiktok_username || creator?.display_name || "").replace(/^@/, "");
    let origin = typeof window !== "undefined" ? window.location.origin : "";
    // Allow override via window.__PUBLIC_APP_URL (can be injected in index.html) or env built value
    const injected = typeof window !== 'undefined' && (window.__PUBLIC_APP_URL || window.__APP_ORIGIN);
    if (injected) origin = injected;
    // Fallback to current origin in dev; final fallback to example domain placeholder
    if (!origin) origin = 'https://example.com';
    return `${origin.replace(/\/$/, '')}/${encodeURIComponent(handle || "creator")}`;
  }, [creator]);

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Support me on TikCash",
          text: "Tip me securely on TikCash:",
          url: shareUrl,
        });
      } else {
        copyToClipboard();
      }
    } catch {}
  };

  return (
    <Card className="border-none shadow-lg w-full overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-blue-600" />
          <CardTitle>Your TikCash Link</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 min-w-0">
            <Input value={shareUrl} readOnly className="w-full" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={copyToClipboard} className="whitespace-nowrap">
              <Copy className="w-4 h-4 mr-2" /> {copied ? "Copied" : "Copy"}
            </Button>
            <Button type="button" onClick={nativeShare} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap">
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
