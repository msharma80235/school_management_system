interface BookItem {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  edition: string | null;
  custom_category: string | null;
  is_mandatory: boolean;
  file_path?: string | null;
  subject: { id: string; name: string; code: string } | null;
}

export default function BookList({ books }: { books: BookItem[] }) {
  if (books.length === 0) {
    return <p className="text-gray-400 text-center py-8">No books assigned yet</p>;
  }

  const grouped = books.reduce<Record<string, BookItem[]>>((acc, book) => {
    const key = book.subject?.name || book.custom_category || 'General';
    (acc[key] = acc[key] || []).push(book);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([groupName, groupBooks]) => (
        <div key={groupName}>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{groupName}</h4>
          <div className="space-y-2">
            {groupBooks.map((book) => (
              <div key={book.id} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{book.title}</p>
                  <p className="text-xs text-gray-500">
                    by {book.author}
                    {book.publisher ? ` • ${book.publisher}` : ''}
                    {book.edition ? ` • ${book.edition} edition` : ''}
                  </p>
                  {book.isbn && <p className="text-xs text-gray-400 font-mono mt-0.5">ISBN: {book.isbn}</p>}
                  {book.file_path && (
                    <a href={`/uploads/${book.file_path}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-xs text-red-600 hover:text-red-800 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      Read book copy
                    </a>
                  )}
                </div>
                {book.is_mandatory ? (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 shrink-0 ml-2">Mandatory</span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 shrink-0 ml-2">Optional</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
