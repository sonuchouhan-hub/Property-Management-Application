
import React from 'react';
import { Article } from '../types';
import Icon from './common/Icon';

interface ArticleDetailsProps {
  article: Article;
}

const ArticleDetails: React.FC<ArticleDetailsProps> = ({ article }) => {
  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden max-w-4xl mx-auto">
      <div className="relative">
        <img src={article.imageUrl} alt={article.title} className="w-full h-64 object-cover" />
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <span className="text-xs font-semibold text-white bg-blue-600 px-2 py-1 rounded-full">{article.category}</span>
          <h1 className="text-3xl font-extrabold text-white mt-2" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.7)' }}>{article.title}</h1>
        </div>
      </div>
      <div className="p-6 md:p-8 space-y-6">
        <p className="text-gray-700 text-lg leading-relaxed">{article.summary}</p>
        <div className="bg-gray-100 p-4 rounded-lg text-gray-600 text-sm">
            <p><strong>Please Note:</strong> This is a summary of the article. In a fully featured application, the complete article content would be displayed here, potentially fetched from a CMS or database.</p>
        </div>
      </div>
    </div>
  );
};

export default ArticleDetails;
