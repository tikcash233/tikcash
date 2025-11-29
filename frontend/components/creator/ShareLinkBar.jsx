import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link as LinkIcon, Copy, Share2, QrCode, Download } from "lucide-react";
import QRCode from "qrcode";

export default function ShareLinkBar({ creator }) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [qrLoading, setQrLoading] = useState(false);

  const handleSlug = useMemo(() => {
    const handle = (creator?.tiktok_username || creator?.display_name || "").replace(/^@/, "");
    return handle || "creator";
  }, [creator]);

  const shareUrl = useMemo(() => {
    let origin = typeof window !== "undefined" ? window.location.origin : "";
    // Allow override via window.__PUBLIC_APP_URL (can be injected in index.html) or env built value
    const injected = typeof window !== 'undefined' && (window.__PUBLIC_APP_URL || window.__APP_ORIGIN);
    if (injected) origin = injected;
    // Fallback to current origin in dev; final fallback to example domain placeholder
    if (!origin) origin = 'https://example.com';
    return `${origin.replace(/\/$/, '')}/${encodeURIComponent(handleSlug)}`;
  }, [handleSlug]);

  useEffect(() => {
    let cancelled = false;
    if (!shareUrl) {
      setQrDataUrl("");
      return;
    }
    setQrLoading(true);
    setQrError("");
    QRCode.toDataURL(shareUrl, {
      margin: 1,
      width: 840,
      color: {
        dark: "#000000",
        light: "#ffffff"
      }
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl("");
          setQrError("Unable to generate QR code. Try again in a moment.");
        }
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

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

  const previewLink = () => {
    if (typeof window === "undefined") return;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${handleSlug}-tikcash-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <div className="flex flex-col gap-6">
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

          <div className="flex flex-col lg:flex-row gap-4 bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <div className="flex-1">
              <div className="flex items-center gap-2 font-semibold text-gray-900">
                <QrCode className="w-5 h-5 text-blue-600" />
                <span>Printable QR code</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Supporters can scan this to open your tipping page instantly. Download and print it for counters, menus, or posters.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button type="button" onClick={downloadQr} disabled={!qrDataUrl || qrLoading}>
                  <Download className="w-4 h-4 mr-2" /> {qrLoading ? "Preparing..." : "Download QR"}
                </Button>
                <Button type="button" variant="ghost" className="text-sm" onClick={previewLink}>Preview link</Button>
              </div>
              {qrError && (
                <p className="text-xs text-red-600 mt-2">{qrError}</p>
              )}
            </div>
            <div className="flex items-center justify-center">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 w-52 h-52 flex items-center justify-center">
                {qrDataUrl && !qrLoading ? (
                  <img src={qrDataUrl} alt="Creator QR code" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center text-sm text-gray-500">
                    {qrLoading ? "Generating QR..." : "QR unavailable"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
