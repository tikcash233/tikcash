import React from "react";

const categories = [
	{ value: "all", label: "All" },
	{ value: "comedy", label: "Comedy" },
	{ value: "dance", label: "Dance" },
	{ value: "food", label: "Food" },
	{ value: "music", label: "Music" },
	{ value: "other", label: "Other" },
];

export default function SearchFilters({ selectedCategory, onCategoryChange }) {
	return (
		<div className="flex flex-wrap gap-2">
			{categories.map((c) => (
				<button
					key={c.value}
					onClick={() => onCategoryChange(c.value)}
					className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
						selectedCategory === c.value
							? "bg-red-600 text-white border-red-600"
							: "bg-white text-gray-700 hover:bg-gray-100 border-gray-300"
					}`}
				>
					{c.label}
				</button>
			))}
		</div>
	);
}

