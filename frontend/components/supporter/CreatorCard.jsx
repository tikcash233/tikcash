import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CreatorCard({ creator, onTip }) {
	if (!creator) return null;
	const { display_name, tiktok_username, profile_image, bio, follower_count, total_earnings, is_verified } = creator;

	return (
		<Card className="border-none shadow-md hover:shadow-lg transition-shadow">
			<CardContent className="p-5">
				<div className="flex items-center gap-4 mb-4">
					<img
						src={profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(display_name)}&size=64&background=ef4444&color=ffffff`}
						alt={display_name}
						className="w-14 h-14 rounded-full border"
					/>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<h3 className="font-semibold truncate">{display_name}</h3>
							{is_verified && (
								<span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Verified</span>
							)}
						</div>
						<p className="text-sm text-gray-500 truncate">@{tiktok_username}</p>
					</div>
				</div>
				{bio && <p className="text-sm text-gray-700 mb-4 line-clamp-3">{bio}</p>}

				<div className="flex items-center justify-between text-sm text-gray-600 mb-4">
					<span>{(follower_count || 0).toLocaleString()} followers</span>
					<span>GH₵ {(total_earnings || 0).toFixed(2)} earned</span>
				</div>

				<Button onClick={onTip} className="w-full">Tip Creator</Button>
			</CardContent>
		</Card>
	);
}

