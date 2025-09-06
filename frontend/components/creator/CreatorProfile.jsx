import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User } from "@/entities/all";
import { useToast } from "@/components/ui/toast.jsx";

// Minimal profile creation form. Calls onCreateProfile with the fields the dashboard expects.
export default function CreatorProfile({ onCreateProfile }) {
	const [me, setMe] = useState(null);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const { success, error } = useToast();
		const [form, setForm] = useState({
			tiktok_username: "",
			display_name: "",
			phone_number: "",
			preferred_payment_method: "momo",
			category: "other",
		});

	useEffect(() => {
		(async () => {
			const u = await User.me();
			setMe(u);
			setLoading(false);
		})();
	}, []);

	const onChange = (e) => {
		const { name, value } = e.target;
		setForm((f) => ({ ...f, [name]: value }));
	};

	const onSubmit = async (e) => {
		e.preventDefault();
		if (!onCreateProfile || submitting) return;
		setSubmitting(true);
		const payload = {
			...form,
			created_by: me?.email,
		};
		try {
			await onCreateProfile(payload);
			success("Profile created successfully.");
		} catch (e) {
			error("Failed to create profile. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-16">
				<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
			</div>
		);
	}

		return (
		<Card className="border-none shadow-lg">
			<CardHeader>
				<CardTitle>Create your creator profile</CardTitle>
			</CardHeader>
			<CardContent>
				<form className="space-y-4" onSubmit={onSubmit}>
					<div>
						<label className="block text-sm font-medium text-gray-700">TikTok Username</label>
						<Input
							name="tiktok_username"
							placeholder="e.g. kwesi_comedy"
							value={form.tiktok_username}
							onChange={onChange}
							required
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700">Display Name</label>
						<Input
							name="display_name"
							placeholder="Your public name"
							value={form.display_name}
							onChange={onChange}
							required
						/>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700">Phone Number</label>
							<Input
								name="phone_number"
							placeholder="e.g. 0241234567"
								value={form.phone_number}
								onChange={onChange}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700">Preferred Payment</label>
							<select
								name="preferred_payment_method"
								className="block w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								value={form.preferred_payment_method}
								onChange={onChange}
							>
							<option value="momo">Mobile Money</option>
							</select>
						</div>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700">Category</label>
						<select
							name="category"
							className="block w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
							value={form.category}
							onChange={onChange}
						>
							<option value="comedy">Comedy</option>
							<option value="dance">Dance</option>
							<option value="food">Food</option>
							<option value="music">Music</option>
							<option value="other">Other</option>
						</select>
					</div>
					<div className="pt-2">
						<Button type="submit" disabled={submitting} className="w-full">
							{submitting ? "Creating..." : "Create Profile"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

