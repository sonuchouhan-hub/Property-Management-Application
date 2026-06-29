
import React from 'react';
import { MOCK_ARTICLES } from '../constants';
import { Article } from '../types';

interface ArticleCardProps {
  article: Article;
  onSelect: (article: Article) => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, onSelect }) => (
  <div 
    onClick={() => onSelect(article)} 
    className="bg-white rounded-lg shadow-md overflow-hidden group cursor-pointer transform hover:-translate-y-1 transition-transform"
  >
    <div className="overflow-hidden">
        <img src={article.imageUrl} alt={article.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
    </div>
    <div className="p-5">
      <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">{article.category}</span>
      <h3 className="text-lg font-bold mt-2 text-gray-800 group-hover:text-blue-700 transition-colors">{article.title}</h3>
      <p className="text-gray-600 mt-2 text-sm h-20 overflow-hidden">{article.summary}</p>
      <div className="text-blue-600 font-semibold mt-4 text-sm">Read More →</div>
    </div>
  </div>
);

interface InsightsProps {
  onSelectArticle: (article: Article) => void;
}

const Insights: React.FC<InsightsProps> = ({ onSelectArticle }) => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-center text-gray-800">Property Insights & News (Rau, Indore)</h1>
        <p className="text-center text-gray-500 mt-1">Stay informed with the latest trends and local real estate advice for Madhya Pradesh.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {MOCK_ARTICLES.map(article => (
          <ArticleCard key={article.id} article={article} onSelect={onSelectArticle} />
        ))}
        {/* Why Invest Section */}
        <div className="md:col-span-2 lg:col-span-3 bg-gradient-to-r from-blue-700 to-blue-900 text-white p-8 rounded-lg flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2">Why Real Estate in Rau is a Golden Opportunity</h2>
                <p>Investing in property around Rau, Indore is not just about owning land; it's about securing your financial future in Madhya Pradesh's fastest-growing residential and institutional corridor. With premium local developments, excellent proximity to major education hubs (like IIM Indore), and long-term capital appreciation, Rau remains the most reliable investment destination. Let us guide you to the perfect plot.</p>
            </div>
            <img src="https://picsum.photos/seed/invest/200/200" alt="Investment" className="w-32 h-32 rounded-full object-cover border-4 border-white"/>
        </div>
      </div>
    </div>
  );
};

export default Insights;