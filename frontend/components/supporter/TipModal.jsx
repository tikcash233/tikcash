import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TipModal({ creator, onSendTip, onClose }) {
	const [amount, setAmount] = useState("");
	const [name, setName] = useState("");
	const [message, setMessage] = useState("");
	const [isSending, setIsSending] = useState(false);
	const presets = [5, 10, 50, 100];

	const submit = async (e) => {
		e.preventDefault();
		const value = parseFloat(amount || "0");
		if (!isFinite(value) || value <= 0) return;
		setIsSending(true);
		try {
			await onSendTip?.({
				creator_id: creator?.id,
				amount: value,
				supporter_name: name || "Anonymous",
				note: message,
				transaction_type: "tip",
			});
		} finally {
			setIsSending(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Send a Tip</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={submit} className="space-y-4">
						<div className="flex items-center gap-3">
							<img
								src={creator?.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator?.display_name || "?")}&size=64&background=ef4444&color=ffffff`}
								alt={creator?.display_name}
								className="w-12 h-12 rounded-full border"
							/>
							<div>
								<p className="font-medium">{creator?.display_name}</p>
								<p className="text-sm text-gray-500">@{creator?.tiktok_username}</p>
							</div>
						</div>

									<div>
										<label className="block text-sm font-medium text-gray-700">Amount</label>
										<div className="flex flex-wrap gap-2 mb-2">
											{presets.map((v) => (
												<button
													key={v}
													type="button"
													onClick={() => setAmount(String(v))}
													className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
														parseFloat(amount || "0") === v
															? "bg-blue-600 text-white border-blue-600"
															: "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"
													}`}
												>
													GH₵ {v}
												</button>
											))}
										</div>
										<div className="relative">
											<span className="absolute left-3 top-2.5 text-gray-500 select-none">GH₵</span>
											<Input
												className="pl-12"
												type="number"
												step="0.01"
												min="0"
												value={amount}
												onChange={(e) => setAmount(e.target.value)}
												placeholder="Enter amount"
												required
											/>
										</div>
									</div>

						<div>
							<label className="block text-sm font-medium text-gray-700">Your name (optional)</label>
							<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Anonymous" />
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700">Message (optional)</label>
							<textarea
								className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								rows={3}
								value={message}
								onChange={(e) => setMessage(e.target.value)}
							/>
						</div>

						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={onClose} disabled={isSending}>Cancel</Button>
							<Button type="submit" disabled={isSending || !amount}>Send Tip</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

