import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, 
  Heart, 
  Shield, 
  Smartphone, 
  DollarSign, 
  Users,
  Star,
  ArrowRight,
  CheckCircle
} from "lucide-react";

export default function Home() {
  const features = [
    {
      icon: Heart,
      title: "Real-Time Tips",
      description: "Receive instant support from your fans with seamless payment integration"
    },
    {
      icon: Shield,
      title: "Secure Payments",
      description: "Your earnings are protected with bank-grade security and instant withdrawals"
    },
    {
      icon: TrendingUp,
      title: "Analytics Dashboard",
      description: "Track your earnings, engagement, and growth with detailed insights"
    },
    {
      icon: Smartphone,
      title: "Mobile-First",
      description: "Designed for TikTok creators with a mobile-optimized experience"
    }
  ];

  const stats = [
    { number: "1,000+", label: "Active Creators" },
    { number: "$50,000+", label: "Total Earnings" },
    { number: "10,000+", label: "Happy Supporters" },
    { number: "99.9%", label: "Uptime" }
  ];

  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-blue-50 py-20 lg:py-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-blue-200 shadow-sm">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700">Creator Monetization Platform</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Turn Your TikTok
              <span className="block bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Into Your Income
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              The premier monetization platform for TikTok creators worldwide. 
              Get tips, track earnings, and withdraw directly to your preferred payment method.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={createPageUrl("CreatorDashboard")}>
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg px-8 py-3 text-lg">
                  Start Earning
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl("SupporterDashboard")}>
                <Button variant="outline" size="lg" className="border-2 border-blue-300 hover:border-blue-400 text-blue-700 hover:bg-blue-50 px-8 py-3 text-lg">
                  Support Creators
                  <Heart className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built for creators worldwide, featuring secure payments and mobile-first design
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              How TikCash Works
            </h2>
            <p className="text-xl text-gray-600">Simple steps to start monetizing your content</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Create Your Profile</h3>
              <p className="text-gray-600">
                Sign up with your TikTok handle and create a profile that showcases your unique content style
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Receive Tips</h3>
              <p className="text-gray-600">
                Share your TikCash link and start receiving tips from fans who love your content
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-700 to-blue-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Withdraw Earnings</h3>
              <p className="text-gray-600">
                Cash out instantly to your preferred payment method with just a few taps
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-800">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Ready to Start Earning?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join thousands of creators who are already monetizing their TikTok content
          </p>
          <Link to={createPageUrl("CreatorDashboard")}>
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 shadow-lg px-8 py-3 text-lg font-semibold">
              Get Started Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}