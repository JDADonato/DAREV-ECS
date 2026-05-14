import { router } from '@inertiajs/react';
import { GALLERY_IMAGES } from '../../data/mockData';
import { useState, useEffect } from 'react';

const HERO_SLIDES = [
    {
        image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2069&auto=format&fit=crop",
        title: "Corporate Events",
        subtitle: "Professional catering services for your business meetings, conferences, and corporate gatherings."
    },
    {
        image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=2069&auto=format&fit=crop",
        title: "Dream Weddings",
        subtitle: "Create unforgettable memories with our elegant wedding catering packages."
    },
    {
        image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=2069&auto=format&fit=crop",
        title: "Private Parties",
        subtitle: "Celebrate life's milestones with delicious food and impeccable service."
    }
];

const ClientOverview = () => {
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
    };

    return (
        <div className="flex flex-col">
            {/* Hero Section */}
            <div className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
                {/* Background Image with Overlay */}
                {HERO_SLIDES.map((slide, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 z-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                    >
                        <img
                            src={slide.image}
                            alt={slide.title}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-red-900/90 to-red-600/40 mix-blend-multiply"></div>
                    </div>
                ))}

                {/* Hero Content */}
                <div className="relative z-10 text-center px-4 max-w-4xl mx-auto mt-16">
                    <h1 className="text-5xl md:text-7xl font-bold font-display text-white mb-6 drop-shadow-lg transition-all duration-500 transform translate-y-0">
                        {HERO_SLIDES[currentSlide].title}
                    </h1>
                    <p className="text-lg md:text-xl text-gray-100 mb-8 font-light max-w-2xl mx-auto leading-relaxed transition-all duration-500 delay-100">
                        {HERO_SLIDES[currentSlide].subtitle}
                    </p>
                    <button
                        onClick={() => router.get('/book')}
                        className="bg-yellow-500 hover:bg-yellow-400 text-red-900 font-bold py-4 px-10 rounded-lg shadow-xl transition-transform transform hover:scale-105 uppercase tracking-wide text-sm"
                    >
                        Book Now
                    </button>

                    {/* Carousel Indicators */}
                    <div className="flex justify-center space-x-3 mt-12">
                        {HERO_SLIDES.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentSlide(index)}
                                className={`w-3 h-3 rounded-full cursor-pointer transition-all duration-300 ${index === currentSlide ? 'bg-yellow-500 w-6' : 'bg-white/50 hover:bg-white'}`}
                            ></button>
                        ))}
                    </div>
                </div>

                {/* Navigation Arrows */}
                <div className="absolute left-8 top-1/2 transform -translate-y-1/2 text-white/50 hidden md:block z-20">
                    <button
                        onClick={prevSlide}
                        className="p-4 border border-white/30 rounded-full hover:bg-white/10 hover:text-white transition-all focus:outline-none"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                </div>
                <div className="absolute right-8 top-1/2 transform -translate-y-1/2 text-white/50 hidden md:block z-20">
                    <button
                        onClick={nextSlide}
                        className="p-4 border border-white/30 rounded-full hover:bg-white/10 hover:text-white transition-all focus:outline-none"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            {/* Recent Events Section */}
            <section className="py-20 bg-orange-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold font-display text-red-900 mb-4">Recent Events We've Catered</h2>
                        <div className="w-24 h-1 bg-yellow-500 mx-auto rounded-full mb-4"></div>
                        <p className="text-gray-600">See what our clients are saying about their experiences</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {GALLERY_IMAGES.map((img, idx) => (
                            <div key={idx} className="group relative overflow-hidden rounded-xl shadow-lg aspect-w-4 aspect-h-3">
                                <img
                                    src={img}
                                    alt={`Event ${idx + 1}`}
                                    className="w-full h-64 object-cover transform group-hover:scale-110 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                                    <div className="text-white">
                                        <h3 className="text-xl font-bold mb-1">Grand Wedding</h3>
                                        <p className="text-sm text-gray-200">Manila Hotel • Dec 2023</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ClientOverview;
