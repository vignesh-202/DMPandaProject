import React from 'react';
import { User } from 'lucide-react';

interface InboxPreviewProps {
    appName?: string;
    appIconUrl?: string;
    items: Array<{
        keyword: string;
        response: string;
    }>;
}

const InboxPreview: React.FC<InboxPreviewProps> = ({
    appName = "Instagram",
    appIconUrl,
    items
}) => {
    return (
        <div className="w-[320px] h-[640px] bg-black rounded-[40px] border-[10px] border-gray-900 shadow-2xl overflow-hidden relative mx-auto font-sans">
            {/* Notch */}
            <div className="absolute top-0 w-full h-8 flex justify-center z-20">
                <div className="w-40 h-6 bg-black rounded-b-3xl"></div>
            </div>

            {/* Status Bar */}
            <div className="w-full h-12 bg-gray-50 flex items-end justify-between px-6 pb-2 text-xs font-semibold z-10 text-black">
                <span>9:41</span>
                <div className="flex gap-1">
                    <div className="w-4 h-3 bg-black rounded-sm"></div>
                    <div className="w-4 h-3 bg-black rounded-sm"></div>
                </div>
            </div>

            {/* App Header */}
            <div className="h-16 bg-white border-b border-gray-100 flex items-center px-4 justify-between sticky top-12 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 p-[2px]">
                        <div className="w-full h-full bg-white rounded-full overflow-hidden">
                            {appIconUrl ? (
                                <img src={appIconUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-full h-full p-1 text-gray-400" />
                            )}
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-black">{appName}</p>
                        <p className="text-[10px] text-gray-500">Active now</p>
                    </div>
                </div>
                <div className="text-blue-500 text-2xl">
                    <i className="fab fa-instagram"></i>
                </div>
            </div>

            {/* Chat Area */}
            <div className="h-[calc(100%-112px)] bg-white p-4 overflow-y-auto flex flex-col gap-4">

                <div className="text-xs text-gray-400 text-center my-2">Today</div>

                {items.length === 0 && (
                    <div className="text-center text-gray-400 mt-10 p-4">
                        <p className="text-sm">Configure your automation to see a preview here.</p>
                    </div>
                )}

                {items.map((item, index) => (
                    <React.Fragment key={index}>
                        {/* User Message (Right) */}
                        <div className="flex justify-end animate-fade-in-up">
                            <div className="bg-[#3797f0] text-white py-2 px-4 rounded-3xl rounded-br-none max-w-[80%] text-sm shadow-sm">
                                {item.keyword}
                            </div>
                        </div>

                        {/* Bot Response (Left) */}
                        <div className="flex justify-start animate-fade-in-up animation-delay-300">
                            <div className="flex flex-col gap-1 max-w-[80%]">
                                <div className="bg-gray-100 text-black py-3 px-4 rounded-3xl rounded-bl-none text-sm break-words shadow-sm">
                                    {item.response}
                                </div>
                                <span className="text-[10px] text-gray-400 ml-2">Sent just now</span>
                            </div>
                        </div>
                    </React.Fragment>
                ))}

            </div>

            {/* Bottom Area */}
            <div className="absolute bottom-0 w-full h-12 bg-white border-t border-gray-100 flex items-center justify-center">
                <div className="w-32 h-1 bg-gray-300 rounded-full mb-2"></div>
            </div>

        </div>
    );
};

export default InboxPreview;
