import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WithdrawalModal({ creator, onWithdraw, onClose }) {
	const [amount, setAmount] = useState("");
	const available = creator?.available_balance || 0;

	const handleSubmit = (e) => {
		e.preventDefault();
		const value = parseFloat(amount || "0");
		if (!isFinite(value) || value <= 0) return;
		if (value > available) return;
		onWithdraw?.(value);
	};

	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
			<Card className="max-w-md w-full">
				<CardHeader>
					<CardTitle>Withdraw Funds</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<p className="text-sm text-gray-600">Available: ${available.toFixed(2)}</p>
						<Input
							type="number"
							step="0.01"
							min="0"
							max={available}
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							placeholder="Enter amount"
							required
						/>
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
							<Button type="submit" disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > available}>Withdraw</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

