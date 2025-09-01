import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User } from "@/entities/all";

// Minimal profile creation form. Calls onCreateProfile with the fields the dashboard expects.
export default function CreatorProfile({ onCreateProfile }) {
	const [me, setMe] = useState(null);
	const [loading, setLoading] = useState(true);
	const [form, setForm] = useState({
		tiktok_username: "",
		display_name: "",
		bio: "",
		phone_number: "",
		preferred_payment_method: "momo",
		profile_image: "",
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
		if (!onCreateProfile) return;
		const payload = {
			...form,
			created_by: me?.email,
		};
		await onCreateProfile(payload);
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
					<div>
						<label className="block text-sm font-medium text-gray-700">Bio</label>
						<textarea
							name="bio"
							className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
							rows={3}
							placeholder="Tell supporters about you"
							value={form.bio}
							onChange={onChange}
						/>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700">Phone Number</label>
							<Input
								name="phone_number"
								placeholder="e.g. +23320..."
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
								<option value="bank_transfer">Bank Transfer</option>
							</select>
						</div>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700">Profile Image URL</label>
						<Input
							name="profile_image"
							placeholder="https://..."
							value={form.profile_image}
							onChange={onChange}
						/>
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
						<Button type="submit" className="w-full">Create Profile</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

