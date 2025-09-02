import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WithdrawalModal({ creator, onWithdraw, onClose }) {
	const [amount, setAmount] = useState("");
		const [momo, setMomo] = useState("");
	const available = creator?.available_balance || 0;

		const MIN_WITHDRAW = 10;
		const momoRegex = useMemo(
			() => /^(020|024|025|026|027|028|029|050|053|054|055|056|057|058|059)\d{7}$/,
			[]
		);

		const amountNumber = useMemo(() => parseFloat(amount || "0"), [amount]);
		const amountInvalid = !isFinite(amountNumber) || amountNumber <= 0 || amountNumber > available || amountNumber < MIN_WITHDRAW;
		const momoInvalid = !momoRegex.test((momo || "").trim());

	const handleSubmit = (e) => {
		e.preventDefault();
		const value = amountNumber;
		if (amountInvalid || momoInvalid) return;

				const confirmMsg = `Withdraw ${value.toFixed(2)} cedis to ${momo}?`;
				const ok = window.confirm(confirmMsg);
				if (!ok) return;

		onWithdraw?.({ amount: value, momo: momo.trim() });
	};

	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
			<Card className="max-w-md w-full">
				<CardHeader>
					<CardTitle>Withdraw Funds</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<p className="text-sm text-gray-600">Available: GH₵ {available.toFixed(2)}</p>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Amount (GH₵)</label>
							<Input
								type="number"
								step="0.01"
								min={MIN_WITHDRAW}
								max={available}
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								placeholder={`Minimum GH₵ ${MIN_WITHDRAW.toFixed(2)}`}
								required
							/>
							{amount && amountNumber < MIN_WITHDRAW && (
								<p className="mt-1 text-xs text-red-600">Minimum withdrawal is GH₵ {MIN_WITHDRAW.toFixed(2)}</p>
							)}
							{amount && amountNumber > available && (
								<p className="mt-1 text-xs text-red-600">Amount exceeds available balance</p>
							)}
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Mobile Money Number</label>
							<Input
								type="tel"
								inputMode="numeric"
								pattern="^(020|024|025|026|027|028|029|050|053|054|055|056|057|058|059)\d{7}$"
								maxLength={10}
								value={momo}
								onChange={(e) => setMomo(e.target.value.replace(/[^0-9]/g, ''))}
								placeholder="e.g. 0241234567"
								required
							/>
							<p className="mt-1 text-xs text-gray-500">Must be a 10‑digit Ghana number starting with 020, 024, 054, 055, 059, 027, 057, 026, 056, 050, etc.</p>
							{momo && momoInvalid && (
								<p className="mt-1 text-xs text-red-600">Enter a valid Ghana mobile money number</p>
							)}
						</div>

						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
							<Button type="submit" disabled={amountInvalid || momoInvalid}>Confirm Withdraw</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

