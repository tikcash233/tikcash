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

		// Withdrawals: creators withdraw their available (net) balance. We do not show
		// a creator/platform fee breakdown here. Processor transfer fees (if any)
		// are handled by the payments provider and are not displayed in this UI.
		const fees = useMemo(() => ({ platform_fee: 0, paystack_fee: 0, creator_amount: amountNumber, platform_net: 0 }), [amountNumber]);

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
								{/* Removed creator/platform breakdown for withdrawals per product rule.
								    Show a short note about possible processor transfer fees instead. */}
								<div className="py-2 text-sm text-gray-600 border-t pt-3">
									<strong>Transfer fee: GHS 1 (charged by payments provider).</strong>
									<p className="mt-1">These fees are charged by the payments provider and deducted during the transfer. The amount you confirm to withdraw will be deducted from your TikCash balance.</p>
									{/* Show estimated receive amount (amount - transfer fee) */}
									{amountNumber > 0 && (
										<div className="mt-2 flex items-center justify-between bg-white border rounded-md p-2">
											<div className="text-sm text-gray-600">Estimated transfer fee</div>
											<div className="font-semibold">GH₵ 1.00</div>
										</div>
									)}
									{amountNumber > 0 && (
										<div className="mt-2 flex items-center justify-between bg-gray-50 border rounded-md p-2">
											<div className="text-sm text-gray-600">Estimated amount to be received</div>
											<div className="font-semibold">GH₵ {(Math.max(0, amountNumber - 1)).toFixed(2)}</div>
										</div>
									)}
								</div>
							</div>
							
							{/* Notice about processing time: shown before the final confirm button */}
							<div role="note" aria-live="polite" className="mt-3 text-sm text-gray-600">
								<strong>Note:</strong> Withdrawals can take up to 24 hours to process after you request them. Please allow up to one business day for the funds to arrive.
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
								<p className="mt-1 text-xs text-gray-500">Must be a 10‑digit Ghana number starting with 020, 024, 054, etc.</p>
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

