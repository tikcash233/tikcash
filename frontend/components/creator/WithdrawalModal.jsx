import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";

export default function WithdrawalModal({ creator, onWithdraw, onClose }) {
	const [amount, setAmount] = useState("");
		const [momo, setMomo] = useState("");
		const [isConfirming, setIsConfirming] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const available = creator?.available_balance || 0;

		const MIN_WITHDRAW = 10;
		const momoRegex = useMemo(
			() => /^(020|024|025|026|027|028|029|050|053|054|055|056|057|058|059)\d{7}$/,
			[]
		);

		const amountNumber = useMemo(() => parseFloat(amount || "0"), [amount]);
		const amountInvalid = !isFinite(amountNumber) || amountNumber <= 0 || amountNumber > available || amountNumber < MIN_WITHDRAW;
		const momoInvalid = !momoRegex.test((momo || "").trim());

		// compute fee breakdown (platform 17%, paystack 2% borne by platform)
		const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
		const fees = useMemo(() => {
			const amt = amountNumber;
			if (!(amt > 0)) return { platform_fee: 0, paystack_fee: 0, creator_amount: 0, platform_net: 0 };
			const platform_fee = round2(amt * 0.17);
			const paystack_fee = round2(amt * 0.02);
			const creator_amount = round2(amt - platform_fee);
			const platform_net = round2(platform_fee - paystack_fee);
			return { platform_fee, paystack_fee, creator_amount, platform_net };
		}, [amountNumber]);

	const handleSubmit = (e) => {
		e.preventDefault();
		const value = amountNumber;
		if (amountInvalid || momoInvalid) return;

				// Move to styled confirmation step instead of browser confirm
				setIsConfirming(true);
	};

	const handleFinalConfirm = () => {
		const value = amountNumber;
		if (amountInvalid || momoInvalid) return;
		if (isSubmitting) return;
		setIsSubmitting(true);
		Promise.resolve(onWithdraw?.({ amount: value, momo: momo.trim() }))
		  .finally(() => setIsSubmitting(false));
	};

	const maskedMomo = (momo || "").replace(/(\d{3})\d{4}(\d{3})/, "$1****$2");

	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
			<Card className="max-w-md w-full">
				<CardHeader>
					<CardTitle>{isConfirming ? "Confirm Withdrawal" : "Withdraw Funds"}</CardTitle>
				</CardHeader>
				<CardContent>
					{isConfirming ? (
						<div className="space-y-4">
							<p className="text-sm text-gray-600">Available: GH₵ {available.toFixed(2)}</p>
							<div className="rounded-lg border p-4 bg-gray-50">
								<div className="flex items-center justify-between py-1">
									<span className="text-sm text-gray-600">Amount</span>
									<span className="font-semibold">GH₵ {amountNumber.toFixed(2)}</span>
								</div>
								<div className="flex items-center justify-between py-1">
									<span className="text-sm text-gray-600">To Mobile Money</span>
									<span className="font-semibold">{momo}</span>
								</div>
								<div className="flex items-center justify-between py-1 pt-3 border-t">
									<span className="text-sm text-gray-600">Creator receives</span>
									<span className="font-semibold">GH₵ {fees.creator_amount.toFixed(2)}</span>
								</div>
								<div className="flex items-center justify-between py-1">
									<span className="text-sm text-gray-600">Platform receives</span>
									<span className="font-semibold">GH₵ {fees.platform_net.toFixed(2)}</span>
								</div>
							</div>
							<div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
								<AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
								<div className="text-sm text-amber-800">
									<p className="font-semibold">Please review before confirming</p>
									<p>This action will deduct from your available balance immediately.</p>
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<Button type="button" variant="outline" onClick={() => setIsConfirming(false)}>Back</Button>
								<Button type="button" onClick={handleFinalConfirm} disabled={isSubmitting}>{isSubmitting ? "Processing..." : "Confirm Withdraw"}</Button>
							</div>
						</div>
					) : (
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
								<Button type="submit" disabled={amountInvalid || momoInvalid}>Continue</Button>
							</div>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

