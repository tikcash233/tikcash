import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, User, TrendingUp, Heart, Menu, X, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { User as ApiUser } from "@/entities/all";
import { useToast } from "@/components/ui/toast.jsx";

const navigationItems = [
	{
		title: "Home",
		url: createPageUrl("Home"),
		icon: Home,
	},
	{
		title: "Creator Dashboard",
		url: createPageUrl("CreatorDashboard"),
		icon: User,
	},
	{
		title: "Support Creators",
		url: createPageUrl("SupporterDashboard"),
		icon: Heart,
	},
];

export default function Layout({ children, currentPageName }) {
	const location = useLocation();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [showBackToTop, setShowBackToTop] = useState(false);
	const isHome = currentPageName === "Home";
	const [loggedIn, setLoggedIn] = useState(false);
	const navigate = useNavigate();
	const { success } = useToast();

	useEffect(() => {
		const onScroll = () => {
			try {
				const y = window.scrollY || document.documentElement.scrollTop || 0;
				setShowBackToTop(y > 300);
			} catch {}
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll();
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

		// Track auth token presence
		useEffect(() => {
			const check = () => {
				try { setLoggedIn(!!localStorage.getItem('tikcash_token')); } catch { setLoggedIn(false); }
			};
			check();
			const onStorage = (e) => { if (e.key === 'tikcash_token') check(); };
			window.addEventListener('storage', onStorage);
			return () => window.removeEventListener('storage', onStorage);
		}, []);

		const onLogout = () => {
			const ok = window.confirm('Are you sure you want to log out?');
			if (!ok) return;
			ApiUser.logout();
			setLoggedIn(false);
			success('Logged out');
			navigate('/auth');
		};

	return (
		<div className="min-h-screen bg-white">
			<style>{`
				:root {
					--primary-blue: #2563eb;
					--primary-blue-dark: #1d4ed8;
					--primary-blue-light: #3b82f6;
					--accent-blue: #60a5fa;
					--light-blue: #eff6ff;
				}
			`}</style>
      
			{/* Header */}
			<header className={`sticky top-0 z-50 ${isHome ? 'bg-white/95 backdrop-blur-lg' : 'bg-white'} border-b border-gray-100`}>
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="flex justify-between items-center h-16">
							{/* Logo */}
							<Link to={createPageUrl("Home")} className="flex items-center space-x-3">
								<div className="relative">
									<div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
										<TrendingUp className="w-6 h-6 text-white" />
									</div>
									<div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-blue-600"></div>
								</div>
								<div className="hidden sm:block">
									<h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">TikCash</h1>
									<p className="text-xs text-gray-500 -mt-1">Creator Platform</p>
								</div>
							</Link>

							{/* Right side (desktop): nav + auth */}
							<div className="hidden md:flex items-center space-x-3">
								<nav className="flex space-x-1">
									{navigationItems.map((item) => (
										<Link
											key={item.title}
											to={item.url}
											className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
												location.pathname === item.url
													? 'bg-blue-50 text-blue-700 shadow-sm'
													: 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
											}`}
										>
											<item.icon className="w-4 h-4" />
											<span>{item.title}</span>
										</Link>
									))}
								</nav>
								{loggedIn ? (
									<Button onClick={onLogout} className="bg-blue-600 hover:bg-blue-700 text-white">Logout</Button>
								) : (
									<Link to="/auth" className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Login</Link>
								)}
							</div>

							{/* Mobile Menu Button */}
							<button
								onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
								className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
							>
								{mobileMenuOpen ? (
									<X className="w-5 h-5" />
								) : (
									<Menu className="w-5 h-5" />
								)}
							</button>
						</div>
				</div>

				{/* Mobile Navigation */}
				{mobileMenuOpen && (
					<div className="md:hidden bg-white border-t border-gray-100 py-2">
						<div className="max-w-7xl mx-auto px-4 space-y-1">
							{navigationItems.map((item) => (
								<Link
									key={item.title}
									to={item.url}
									onClick={() => setMobileMenuOpen(false)}
									className={`flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
										location.pathname === item.url
											? 'bg-blue-50 text-blue-700'
											: 'text-gray-600 hover:bg-gray-50'
									}`}
								>
									<item.icon className="w-5 h-5" />
									<span>{item.title}</span>
								</Link>
							))}
									<div className="pt-2">
										{loggedIn ? (
											<button onClick={() => { setMobileMenuOpen(false); onLogout(); }} className="w-full text-left px-3 py-3 rounded-lg text-sm font-medium text-white bg-blue-600">Logout</button>
										) : (
											<Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="w-full inline-block px-3 py-3 rounded-lg text-sm font-medium text-white bg-blue-600">Login</Link>
										)}
									</div>
						</div>
					</div>
				)}
			</header>

			{/* Main Content */}
			<main className="flex-1">
				{children}
			</main>

					{/* Back to Top */}
					{showBackToTop && (
						<button
							aria-label="Back to top"
							onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
							className="fixed bottom-6 right-6 md:bottom-8 md:right-8 h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-colors"
						>
							<ArrowUp className="w-5 h-5" />
						</button>
					)}

			{/* Footer */}
			{isHome && (
				<footer className="bg-gray-900 text-white py-12">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="grid md:grid-cols-4 gap-8">
							<div className="md:col-span-2">
								<div className="flex items-center space-x-3 mb-4">
									<div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
										<TrendingUp className="w-6 h-6 text-white" />
									</div>
									<div>
										<h3 className="text-xl font-bold">TikCash</h3>
										<p className="text-gray-400 text-sm">Creator Platform</p>
									</div>
								</div>
								<p className="text-gray-400 mb-4">
									Empowering TikTok creators to monetize their content and connect with supporters worldwide.
								</p>
							</div>
							<div>
								<h4 className="font-semibold mb-4">Platform</h4>
								<ul className="space-y-2 text-gray-400 text-sm">
									<li><Link to={createPageUrl("CreatorDashboard")} className="hover:text-white transition-colors">For Creators</Link></li>
									<li><Link to={createPageUrl("SupporterDashboard")} className="hover:text-white transition-colors">For Supporters</Link></li>
								</ul>
							</div>
							<div>
								<h4 className="font-semibold mb-4">Support</h4>
								<ul className="space-y-2 text-gray-400 text-sm">
									<li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
									<li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
									<li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
								</ul>
							</div>
						</div>
						<div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
							<p>&copy; 2025 TikCash. Built for creators worldwide.</p>
						</div>
					</div>
				</footer>
			)}
		</div>
	);
}
